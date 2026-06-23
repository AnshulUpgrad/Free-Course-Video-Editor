import os
import sys
import uuid
import logging
import requests
import subprocess
import shutil
import json
from dotenv import load_dotenv
from timeline_service import process_transcript_to_timeline

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
TRANSCRIPTION_FOLDER = os.path.join(BASE_DIR, 'transcriptions')
TIMELINES_FOLDER = os.path.join(BASE_DIR, 'timelines')
VIDEO_PUBLIC_UPLOADS = os.path.join(BASE_DIR, 'video', 'public', 'uploads')
RENDER_FOLDER = os.path.join(BASE_DIR, 'renders')
PROMPTS_FOLDER = os.path.join(BASE_DIR, 'prompts')

# Ensure directories exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRANSCRIPTION_FOLDER, exist_ok=True)
os.makedirs(TIMELINES_FOLDER, exist_ok=True)
os.makedirs(VIDEO_PUBLIC_UPLOADS, exist_ok=True)
os.makedirs(RENDER_FOLDER, exist_ok=True)
os.makedirs(PROMPTS_FOLDER, exist_ok=True)

def load_system_prompt(filename='video_director.md'):
    prompt_path = os.path.join(PROMPTS_FOLDER, filename)
    with open(prompt_path, 'r', encoding='utf-8') as f:
        return f.read().strip()

def extract_audio_from_video(video_path, audio_path):
    """
    Extracts the audio channel from a video file and saves it as an MP3.
    Uses system ffmpeg command.
    """
    try:
        logger.info(f"Extracting audio from video: {video_path} -> {audio_path}")
        command = [
            'ffmpeg',
            '-y',               # Overwrite output files without asking
            '-i', video_path,   # Input file
            '-vn',              # Disable video recording
            '-acodec', 'libmp3lame', # Use MP3 codec
            '-ar', '44100',     # Audio sampling rate
            '-ac', '2',         # Stereo
            '-b:a', '192k',     # Bitrate
            audio_path          # Output path
        ]
        result = subprocess.run(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        logger.info("Audio extraction completed successfully via ffmpeg.")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"ffmpeg extraction failed (exit code {e.returncode}): {e.stderr}")
        return False
    except Exception as e:
        logger.error(f"An unexpected error occurred during audio extraction: {e}")
        return False

def transcribe_audio(audio_filepath, filename, model_size='base'):
    """
    Transcribes audio using Modal Whisper service (Pathway A or Pathway B fallback).
    """
    use_modal = os.environ.get('USE_MODAL', 'true').lower() == 'true'
    modal_transcribe_url = os.environ.get('MODAL_TRANSCRIBE_URL')

    logger.info(f"Starting transcription for {filename} using model_size: {model_size}")
    transcription_payload = None
    pathway_used = None

    # PATHWAY A: Native Modal SDK Client (Preferred)
    if use_modal:
        try:
            logger.info("Attempting transcription via Native Modal Python SDK...")
            import modal
            
            with open(audio_filepath, 'rb') as f:
                audio_bytes = f.read()

            WhisperTranscriber = modal.Cls.from_name("whisper-transcribe", "WhisperTranscriber")
            transcriber_instance = WhisperTranscriber()
            
            transcription_payload = transcriber_instance.transcribe.remote(
                audio_bytes,
                model_size
            )
            pathway_used = "Native Modal SDK (Pathway A)"
            logger.info("Transcription completed successfully via Native SDK.")
        except Exception as sdk_err:
            logger.warning(f"Native Modal SDK transcription failed: {sdk_err}. Trying fallback paths...")

    # PATHWAY B: HTTP Endpoint Fallback
    if not transcription_payload and modal_transcribe_url:
        try:
            logger.info(f"Attempting transcription via HTTP Fallback URL: {modal_transcribe_url}")
            transcribe_endpoint = modal_transcribe_url
            if not transcribe_endpoint.endswith('/transcribe'):
                transcribe_endpoint = f"{transcribe_endpoint.rstrip('/')}/transcribe"
            
            with open(audio_filepath, 'rb') as f:
                files = {'file': (filename, f, 'audio/mpeg')}
                post_data = {'model_size': model_size}
                
                response = requests.post(transcribe_endpoint, files=files, data=post_data, timeout=600)
                
                if response.status_code == 200:
                    transcription_payload = response.json()
                    pathway_used = "HTTP Endpoint Fallback (Pathway B)"
                    logger.info("Transcription completed successfully via HTTP fallback.")
                else:
                    logger.warning(f"HTTP fallback endpoint returned status {response.status_code}: {response.text}")
        except Exception as http_err:
            logger.warning(f"HTTP Fallback transcription failed: {http_err}")

    # PATHWAY C: Local Whisper (faster-whisper)
    if not transcription_payload:
        try:
            logger.info("Attempting Local Fallback transcription using faster-whisper...")
            from faster_whisper import WhisperModel
            
            model = WhisperModel(model_size, device="cpu", compute_type="int8")
            segments, info = model.transcribe(audio_filepath, beam_size=5, word_timestamps=True)
            
            segments_list = []
            full_text = []
            
            for segment in segments:
                words_list = []
                if segment.words:
                    for w in segment.words:
                        words_list.append({
                            'start': w.start,
                            'end': w.end,
                            'word': w.word,
                            'probability': w.probability
                        })
                
                segments_list.append({
                    'start': segment.start,
                    'end': segment.end,
                    'text': segment.text,
                    'words': words_list
                })
                full_text.append(segment.text)
                
            transcription_payload = {
                'text': " ".join(full_text),
                'segments': segments_list,
                'language': info.language,
                'language_probability': info.language_probability
            }
            pathway_used = "Local Whisper CPU Fallback (Pathway C)"
            logger.info("Transcription completed successfully via Local CPU fallback.")
        except Exception as local_err:
            logger.error(f"Local transcription fallback failed: {local_err}")
            return None

    return transcription_payload

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Process video timeline and optionally render it.")
    parser.add_argument("video_path", help="Path to the source video file")
    parser.add_argument("--no-render", action="store_true", help="Skip rendering and only update the timeline for Remotion Studio preview")
    
    args = parser.parse_args()
    
    video_path = args.video_path
    if not os.path.exists(video_path):
        print(f"Error: Video file not found at '{video_path}'")
        sys.exit(1)
        
    # Get base name for output files
    base_name = os.path.splitext(os.path.basename(video_path))[0]
    logger.info(f"Processing video: {video_path} (base name: {base_name})")
    
    # 1. Extract Audio
    audio_filename = f"{base_name}.mp3"
    audio_path = os.path.join(UPLOAD_FOLDER, audio_filename)
    if not os.path.exists(audio_path):
        success = extract_audio_from_video(video_path, audio_path)
        if not success:
            logger.error("Audio extraction failed.")
            sys.exit(1)
    else:
        logger.info(f"Audio already extracted at {audio_path}")
        
    # 2. Transcribe Audio
    transcription_file = os.path.join(TRANSCRIPTION_FOLDER, f"{base_name}.json")
    if not os.path.exists(transcription_file):
        transcription_payload = transcribe_audio(audio_path, audio_filename)
        if not transcription_payload:
            logger.error("Transcription failed.")
            sys.exit(1)
        with open(transcription_file, 'w', encoding='utf-8') as f:
            json.dump(transcription_payload, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved transcription to {transcription_file}")
    else:
        logger.info(f"Transcription file already exists at {transcription_file}")
        with open(transcription_file, 'r', encoding='utf-8') as f:
            transcription_payload = json.load(f)
            
    # 3. Analyze and build timeline configuration using timeline_service
    timeline_file = os.path.join(TIMELINES_FOLDER, f"{base_name}.json")
    
    # Force generating/updating the timeline for preview purposes
    logger.info("Generating timeline configuration...")
    timeline_payload = process_transcript_to_timeline(
        base_name=base_name,
        transcription_payload=transcription_payload,
        video_path=video_path
    )
    if not timeline_payload:
        logger.error("Failed to generate timeline configuration.")
        sys.exit(1)
        
    if args.no_render:
        logger.info("Timeline configuration generated successfully. --no-render is set, skipping video rendering.")
        print(f"\nSUCCESS: Timeline configuration copied directly to Remotion Studio preview at video/src/timeline.json.\n")
        sys.exit(0)
        
    # 5. Render Video using Remotion CLI
    output_filename = f"{base_name}_rendered.mp4"
    output_path = os.path.join(RENDER_FOLDER, output_filename)
    
    video_dir = os.path.join(BASE_DIR, 'video')
    logger.info(f"Starting Remotion render to {output_path}...")
    
    # Run remotion command using cmd.exe /c to bypass PowerShell restrictions on Windows
    cmd = f'cmd.exe /c npx remotion render Showcase "{output_path}" --props="{timeline_file}" --overwrite'
    
    try:
        process = subprocess.Popen(
            cmd,
            cwd=video_dir,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            shell=True
        )
        
        # Stream output in real-time
        for line in process.stdout:
            sys.stdout.write(line)
            sys.stdout.flush()
            
        process.wait()
        
        if process.returncode == 0:
            logger.info("Remotion render completed successfully.")
            print(f"\nSUCCESS: Processed video generated at:\n{output_path}\n")
        else:
            logger.error(f"Remotion render failed (exit code {process.returncode})")
            sys.exit(1)
    except Exception as e:
        logger.error(f"An unexpected error occurred during rendering: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
