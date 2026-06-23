import os
import uuid
import logging
import requests
import subprocess
import shutil
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load env variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for local cross-origin development

# Configure directories
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploads')
TRANSCRIPTION_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'transcriptions')
TIMELINES_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'timelines')
VIDEO_PUBLIC_UPLOADS = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'video', 'public', 'uploads')
RENDER_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'renders')
PROMPTS_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'prompts')

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


# Helper to check allowed file extensions
ALLOWED_EXTENSIONS = {'mp3', 'wav', 'm4a', 'flac', 'webm', 'mp4'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """
    Saves an uploaded audio file to the uploads directory.
    Expects a multipart form parameter named 'file'.
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if file and allowed_file(file.filename):
        # Generate safe unique filename
        file_ext = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        
        file.save(filepath)
        logger.info(f"File uploaded successfully: {unique_filename}")
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': unique_filename,
            'original_filename': file.filename
        }), 200
        
    return jsonify({'error': 'File type not allowed'}), 400

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

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """
    Triggers audio transcription of a previously uploaded file.
    Expects JSON body with:
      - filename: unique name returned from /api/upload
      - model_size: whisper model size (e.g. tiny, base, small, large-v3) - default: 'base'
      - modal_token_id: optional credentials override
      - modal_token_secret: optional credentials override
    """
    data = request.json or {}
    filename = data.get('filename')
    model_size = data.get('model_size', 'base')
    modal_token_id = data.get('modal_token_id')
    modal_token_secret = data.get('modal_token_secret')
    
    if not filename:
        return jsonify({'error': 'Filename parameter is required'}), 400
        
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(filepath):
        return jsonify({'error': 'Audio/Video file not found on server'}), 404
        
    # Check if the file is a video file and needs audio extraction
    file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    video_extensions = {'mp4', 'webm', 'mkv', 'avi', 'mov'}
    
    transcribe_filepath = filepath
    
    if file_ext in video_extensions:
        audio_filename = f"{filename.rsplit('.', 1)[0]}.mp3"
        audio_filepath = os.path.join(UPLOAD_FOLDER, audio_filename)
        
        # Extract audio using ffmpeg if it doesn't already exist
        if not os.path.exists(audio_filepath):
            success = extract_audio_from_video(filepath, audio_filepath)
            if not success:
                return jsonify({'error': 'Failed to extract audio from video file using ffmpeg'}), 500
        else:
            logger.info(f"Extracted audio already exists: {audio_filename}")
            
        transcribe_filepath = audio_filepath
        filename = audio_filename  # Update filename for output JSON naming
        
    # Dynamically inject credentials overrides if provided
    if modal_token_id:
        os.environ['MODAL_TOKEN_ID'] = modal_token_id
    if modal_token_secret:
        os.environ['MODAL_TOKEN_SECRET'] = modal_token_secret

    use_modal = os.environ.get('USE_MODAL', 'true').lower() == 'true'
    modal_transcribe_url = os.environ.get('MODAL_TRANSCRIBE_URL')

    logger.info(f"Starting transcription task for {filename} using model_size: {model_size}")

    transcription_payload = None
    pathway_used = None

    # PATHWAY A: Native Modal SDK Client (Preferred)
    if use_modal:
        try:
            logger.info("Attempting transcription via Native Modal Python SDK...")
            import modal
            
            # Read file bytes to pass to Modal remote function
            with open(transcribe_filepath, 'rb') as f:
                audio_bytes = f.read()

            # Dynamic lookup of deployed serverless app WhisperTranscriber
            WhisperTranscriber = modal.Cls.from_name("whisper-transcribe", "WhisperTranscriber")
            transcriber_instance = WhisperTranscriber()
            
            # Call remote GPU-Whisper execution on Modal
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
            
            with open(transcribe_filepath, 'rb') as f:
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

    # PATHWAY C: Local CPU/GPU fallback using faster-whisper (if installed locally)
    if not transcription_payload:
        try:
            logger.info("Attempting Local Fallback transcription using faster-whisper...")
            from faster_whisper import WhisperModel
            
            # Use CPU by default to keep local resource usage standard
            model = WhisperModel(model_size, device="cpu", compute_type="int8")
            segments, info = model.transcribe(transcribe_filepath, beam_size=5, word_timestamps=True)
            
            # Reconstruct transcript payload layout to match Modal payload schema
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
            return jsonify({
                'error': 'Transcription failed across all pathways (Native SDK, HTTP Fallback, Local CPU)'
            }), 500

    # Save transcription payload output to directory
    output_filename = f"{filename.rsplit('.', 1)[0]}.json"
    output_path = os.path.join(TRANSCRIPTION_FOLDER, output_filename)
    
    import json
    with open(output_path, 'w', encoding='utf-8') as out_f:
        json.dump(transcription_payload, out_f, indent=2, ensure_ascii=False)
        
    logger.info(f"Saved transcript to {output_path}")

    return jsonify({
        'message': 'Transcription completed successfully',
        'pathway': pathway_used,
        'transcript_file': output_filename,
        'transcription': transcription_payload
    }), 200

def split_transcript_into_sentences(transcription_payload):
    """
    Groups word-level timestamps from Whisper into sentences based on punctuation.
    """
    sentences = []
    current_words = []
    
    # Extract all words sequentially from all segments
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
        
        # Check if word ends with punctuation (. ! ?)
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

@app.route('/api/analyze', methods=['POST'])
def analyze_script():
    """
    Groups sentences into slides/chunks and maps them to Remotion templates using OpenRouter Gemini API.
    Expects JSON body:
      - filename: base audio filename (e.g. sample.mp3)
      - model: optional OpenRouter model (default: google/gemini-2.5-flash)
    """
    data = request.json or {}
    filename = data.get('filename')
    openrouter_model = data.get('model', os.environ.get('OPENROUTER_MODEL', 'google/gemini-2.5-flash'))
    
    if not filename:
        return jsonify({'error': 'Filename parameter is required'}), 400
        
    # Standardize filename to find transcription JSON
    base_name = filename.rsplit('.', 1)[0]
    json_filename = f"{base_name}.json"
    json_path = os.path.join(TRANSCRIPTION_FOLDER, json_filename)
    
    if not os.path.exists(json_path):
        return jsonify({'error': f'Transcription file not found: {json_filename}. Please run transcribe first.'}), 404
        
    import json
    with open(json_path, 'r', encoding='utf-8') as f:
        transcription_payload = json.load(f)
        
    # 1. Split into sentences with timestamps
    sentences = split_transcript_into_sentences(transcription_payload)
    if not sentences:
        return jsonify({'error': 'Could not extract sentences from transcription payload'}), 400
        
    # 2. Get OpenRouter API credentials
    openrouter_key = os.environ.get('OPENROUTER_API_KEY')
    if not openrouter_key:
        return jsonify({'error': 'OPENROUTER_API_KEY environment variable is not set'}), 500
        
    # 3. Call OpenRouter Gemini API
    try:
        system_prompt = load_system_prompt('video_director.md')
    except Exception as e:
        logger.error(f"Failed to load system prompt: {e}")
        return jsonify({'error': f"Failed to load system prompt: {e}"}), 500

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
            return jsonify({'error': f"OpenRouter API returned error {response.status_code}"}), 502
            
        result_json = response.json()
        raw_content = result_json['choices'][0]['message']['content'].strip()
        
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:]
        if raw_content.endswith("```"):
            raw_content = raw_content[:-3]
        raw_content = raw_content.strip()
        
        analysis_result = json.loads(raw_content)
    except Exception as e:
        logger.error(f"Failed to communicate with or parse response from OpenRouter: {e}")
        return jsonify({'error': f"LLM analysis failed: {e}"}), 502
        
    # 4. Snap boundaries and calculate durations in frames
    total_duration = transcription_payload.get('duration', 0.0)
    if total_duration == 0.0:
        total_duration = sentences[-1]['end'] if sentences else 0.0
        
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
        
    # Find source audio path
    src_audio_path = os.path.join(UPLOAD_FOLDER, f"{base_name}.mp3")
    audio_ext = "mp3"
    if not os.path.exists(src_audio_path):
        for ext in ['wav', 'm4a', 'flac']:
            if os.path.exists(os.path.join(UPLOAD_FOLDER, f"{base_name}.{ext}")):
                src_audio_path = os.path.join(UPLOAD_FOLDER, f"{base_name}.{ext}")
                audio_ext = ext
                break
                
    dest_filename = f"{base_name}.{audio_ext}"
    dest_audio_path = os.path.join(VIDEO_PUBLIC_UPLOADS, dest_filename)
    
    if os.path.exists(src_audio_path):
        try:
            shutil.copy2(src_audio_path, dest_audio_path)
            logger.info(f"Copied audio to Remotion public uploads: {dest_audio_path}")
        except Exception as e:
            logger.error(f"Failed to copy audio to Remotion public uploads: {e}")
    else:
        logger.warning(f"Source audio file not found, cannot copy to Remotion public uploads: {src_audio_path}")
            
    audio_path = f"uploads/{dest_filename}"
                
    timeline_payload = {
        "audioUrl": audio_path,
        "timeline": timeline_segments
    }
    
    output_filename = f"{base_name}.json"
    output_path = os.path.join(TIMELINES_FOLDER, output_filename)
    
    with open(output_path, 'w', encoding='utf-8') as out_f:
        json.dump(timeline_payload, out_f, indent=2, ensure_ascii=False)
        
    logger.info(f"Saved timeline mapping to {output_path}")
    
    return jsonify({
        'message': 'AI Script analysis and timeline generation completed successfully',
        'timeline_file': output_filename,
        'timeline': timeline_payload
    }), 200

@app.route('/api/render', methods=['POST'])
def render_video():
    """
    Spawns Remotion CLI to render the dynamic Showcase composition.
    Expects JSON body:
      - filename: base audio filename (e.g. sample.mp3)
    """
    data = request.json or {}
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'error': 'Filename parameter is required'}), 400
        
    base_name = filename.rsplit('.', 1)[0]
    timeline_filename = f"{base_name}.json"
    timeline_path = os.path.join(TIMELINES_FOLDER, timeline_filename)
    
    if not os.path.exists(timeline_path):
        return jsonify({'error': f'Timeline mapping not found: {timeline_filename}. Please run analyze first.'}), 404
        
    output_filename = f"{base_name}_rendered.mp4"
    output_path = os.path.join(RENDER_FOLDER, output_filename)
    
    video_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'video')
    
    logger.info(f"Starting Remotion render for {base_name}...")
    logger.info(f"Props: {timeline_path}")
    logger.info(f"Output: {output_path}")
    
    # Run remotion command using shell=True to handle npx resolve on Windows correctly
    cmd = f'npx remotion render Showcase "{output_path}" --props="{timeline_path}"'
    
    try:
        result = subprocess.run(
            cmd,
            cwd=video_dir,
            shell=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=600
        )
        
        if result.returncode == 0:
            logger.info(f"Remotion render completed successfully: {output_path}")
            return jsonify({
                'message': 'Video rendered successfully',
                'rendered_file': output_filename,
                'output_path': output_path,
                'stdout': result.stdout
            }), 200
        else:
            logger.error(f"Remotion render failed with code {result.returncode}")
            logger.error(f"stderr: {result.stderr}")
            return jsonify({
                'error': 'Remotion rendering process failed',
                'returncode': result.returncode,
                'stdout': result.stdout,
                'stderr': result.stderr
            }), 500
            
    except subprocess.TimeoutExpired as e:
        logger.error(f"Remotion rendering timed out: {e}")
        return jsonify({'error': 'Remotion rendering timed out after 10 minutes'}), 504
    except Exception as e:
        logger.error(f"Failed to run Remotion render command: {e}")
        return jsonify({'error': f'Rendering failed: {e}'}), 500

@app.route('/renders/<filename>')
def serve_render(filename):
    from flask import send_from_directory
    return send_from_directory(RENDER_FOLDER, filename)

@app.route('/uploads/<filename>')
def serve_upload(filename):
    from flask import send_from_directory
    return send_from_directory(UPLOAD_FOLDER, filename)

if __name__ == '__main__':
    # Run Flask server locally
    app.run(host='127.0.0.1', port=5000, debug=True)
