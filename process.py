import os
import sys
import uuid
import logging
import requests
import subprocess
import shutil
import json
from dotenv import load_dotenv

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

def split_transcript_into_sentences(transcription_payload):
    """
    Groups word-level timestamps from Whisper into sentences based on punctuation.
    """
    sentences = []
    current_words = []
    
    all_words = []
    for segment in transcription_payload.get('segments', []):
        all_words.extend(segment.get('words', []))
        
    if not all_words:
        logger.warning("No word-level timestamps found. Falling back to segment-level splitting.")
        for i, seg in enumerate(transcription_payload.get('segments', [])):
            sentences.append({
                'index': i,
                'start': seg.get('start', 0.0),
                'end': seg.get('end', 0.0),
                'text': seg.get('text', '').strip()
            })
        return sentences

    sentence_idx = 0
    for word_info in all_words:
        word_text = word_info.get('word', '')
        current_words.append(word_info)
        
        clean_word = word_text.strip()
        if clean_word and clean_word[-1] in {'.', '!', '?'}:
            sentence_text = " ".join([w.get('word', '').strip() for w in current_words])
            sentences.append({
                'index': sentence_idx,
                'start': current_words[0].get('start', 0.0),
                'end': current_words[-1].get('end', 0.0),
                'text': sentence_text
            })
            sentence_idx += 1
            current_words = []
            
    if current_words:
        sentence_text = " ".join([w.get('word', '').strip() for w in current_words])
        sentences.append({
            'index': sentence_idx,
            'start': current_words[0].get('start', 0.0),
            'end': current_words[-1].get('end', 0.0),
            'text': sentence_text
        })
        
    return sentences

def analyze_script(sentences, filename, openrouter_model='google/gemini-2.5-flash'):
    """
    Segment sentences into slides/chunks and map to templates using OpenRouter API.
    """
    openrouter_key = os.environ.get('OPENROUTER_API_KEY')
    if not openrouter_key:
        logger.error("OPENROUTER_API_KEY environment variable is not set")
        return None

    try:
        system_prompt = load_system_prompt('video_director.md')
    except Exception as e:
        logger.error(f"Failed to load system prompt: {e}")
        return None

    headers = {
        "Authorization": f"Bearer {openrouter_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "http://127.0.0.1:5000",
        "X-Title": "Educational Video AI Editor"
    }
    
    payload = {
        "model": openrouter_model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": json.dumps(sentences, indent=2)}
        ],
        "response_format": {"type": "json_object"}
    }
    
    logger.info(f"Calling OpenRouter Gemini API with model: {openrouter_model}")
    try:
        response = requests.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers=headers,
            json=payload,
            timeout=120
        )
        
        if response.status_code != 200:
            logger.error(f"OpenRouter API returned error {response.status_code}: {response.text}")
            return None
            
        result_json = response.json()
        raw_content = result_json['choices'][0]['message']['content'].strip()
        
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:]
        if raw_content.endswith("```"):
            raw_content = raw_content[:-3]
        raw_content = raw_content.strip()
        
        return json.loads(raw_content)
    except Exception as e:
        logger.error(f"Failed to communicate with or parse response from OpenRouter: {e}")
        return None

def build_timeline(analysis_result, sentences, total_duration):
    """
    Constructs the Remotion timeline props.
    """
    timeline_segments = []
    last_end_time = 0.0
    
    chunks = analysis_result.get('chunks', [])
    for i, chunk in enumerate(chunks):
        s_idx = chunk.get('start_sentence_index', 0)
        e_idx = chunk.get('end_sentence_index', 0)
        
        s_idx = max(0, min(s_idx, len(sentences) - 1))
        e_idx = max(0, min(e_idx, len(sentences) - 1))
        if s_idx > e_idx:
            s_idx, e_idx = e_idx, s_idx
            
        start_time = sentences[s_idx]['start']
        end_time = sentences[e_idx]['end']
        
        if i == 0:
            start_time = 0.0
        else:
            start_time = last_end_time
            
        if i == len(chunks) - 1:
            end_time = total_duration
            
        duration = max(0.5, end_time - start_time)
        end_time = start_time + duration
        last_end_time = end_time
        
        duration_in_frames = int(duration * 30)
        
        timeline_segments.append({
            "templateId": chunk.get('template_id'),
            "durationInFrames": duration_in_frames,
            "startTime": round(start_time, 2),
            "endTime": round(end_time, 2),
            "data": chunk.get('data', {})
        })
        
    return timeline_segments

def main():
    if len(sys.argv) < 2:
        print("Usage: python process.py <path_to_video_file>")
        sys.exit(1)
        
    video_path = sys.argv[1]
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
            
    # 3. Split into sentences
    sentences = split_transcript_into_sentences(transcription_payload)
    if not sentences:
        logger.error("Failed to split transcript into sentences.")
        sys.exit(1)
        
    # 4. Analyze/Segment with OpenRouter
    timeline_file = os.path.join(TIMELINES_FOLDER, f"{base_name}.json")
    if not os.path.exists(timeline_file):
        analysis_result = analyze_script(sentences, audio_filename)
        if not analysis_result:
            logger.error("Script analysis / segmentation failed.")
            sys.exit(1)
            
        total_duration = transcription_payload.get('duration', 0.0)
        if total_duration == 0.0:
            total_duration = sentences[-1]['end'] if sentences else 0.0
            
        timeline_segments = build_timeline(analysis_result, sentences, total_duration)
        
        # Copy audio file to Remotion's public uploads directory
        dest_audio_path = os.path.join(VIDEO_PUBLIC_UPLOADS, audio_filename)
        try:
            shutil.copy2(audio_path, dest_audio_path)
            logger.info(f"Copied audio to Remotion public uploads: {dest_audio_path}")
        except Exception as e:
            logger.error(f"Failed to copy audio to Remotion public uploads: {e}")
            
        # Copy video file to Remotion's public uploads directory
        video_filename = os.path.basename(video_path)
        dest_video_path = os.path.join(VIDEO_PUBLIC_UPLOADS, video_filename)
        try:
            shutil.copy2(video_path, dest_video_path)
            logger.info(f"Copied video to Remotion public uploads: {dest_video_path}")
        except Exception as e:
            logger.error(f"Failed to copy video to Remotion public uploads: {e}")
            
        timeline_payload = {
            "audioUrl": f"uploads/{audio_filename}",
            "videoUrl": f"uploads/{video_filename}",
            "timeline": timeline_segments
        }
        
        with open(timeline_file, 'w', encoding='utf-8') as f:
            json.dump(timeline_payload, f, indent=2, ensure_ascii=False)
        logger.info(f"Saved timeline config to {timeline_file}")
    else:
        logger.info(f"Timeline config already exists at {timeline_file}")
        
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
