import os
import uuid
import logging
import requests
import subprocess
import shutil
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from timeline_service import process_transcript_to_timeline

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Load env variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for local cross-origin development

# Configure directories
is_cloud_run = os.environ.get('K_SERVICE') is not None
base_dir = '/app/gcs' if is_cloud_run else os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(base_dir, 'uploads')
TRANSCRIPTION_FOLDER = os.path.join(base_dir, 'transcriptions')
TIMELINES_FOLDER = os.path.join(base_dir, 'timelines')
VIDEO_PUBLIC_UPLOADS = os.path.join(base_dir, 'video_public_uploads') if is_cloud_run else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'video', 'public', 'uploads')
RENDER_FOLDER = os.path.join(base_dir, 'renders')
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
        
        # Save metadata file
        try:
            import json
            from datetime import datetime
            base_name = unique_filename.rsplit('.', 1)[0]
            meta_path = os.path.join(UPLOAD_FOLDER, f"{base_name}.meta.json")
            meta_data = {
                'original_filename': file.filename,
                'uploaded_at': datetime.now().isoformat(),
                'file_size': os.path.getsize(filepath)
            }
            with open(meta_path, 'w', encoding='utf-8') as meta_f:
                json.dump(meta_data, meta_f, indent=2, ensure_ascii=False)
            logger.info(f"Saved upload metadata to {meta_path}")
        except Exception as e:
            logger.error(f"Failed to save upload metadata: {e}")
        
        return jsonify({
            'message': 'File uploaded successfully',
            'filename': unique_filename,
            'original_filename': file.filename
        }), 200
        
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/api/upload/signed-url', methods=['POST'])
def get_upload_signed_url():
    """
    Generates a GCS signed PUT URL for direct browser uploads.
    """
    data = request.json or {}
    filename = data.get('filename')
    content_type = data.get('contentType')
    
    if not filename or not content_type:
        return jsonify({'error': 'filename and contentType are required'}), 400
        
    file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if file_ext not in ALLOWED_EXTENSIONS:
        return jsonify({'error': 'File type not allowed'}), 400
        
    unique_filename = f"{uuid.uuid4().hex}.{file_ext}"
    bucket_name = os.environ.get('GCS_BUCKET_NAME', 'upgrad-video-editor-remotion-assets-583143651967')
    
    try:
        from google.cloud import storage
        import datetime
        
        storage_client = storage.Client()
        bucket = storage_client.bucket(bucket_name)
        blob = bucket.blob(f"uploads/{unique_filename}")
        
        signed_url = blob.generate_signed_url(
            version="v4",
            expiration=datetime.timedelta(minutes=15),
            method="PUT",
            content_type=content_type,
        )
        
        # Save temporary metadata file to FUSE folder
        base_name = unique_filename.rsplit('.', 1)[0]
        meta_path = os.path.join(UPLOAD_FOLDER, f"{base_name}.meta.json")
        
        meta_data = {
            'original_filename': filename,
            'uploaded_at': datetime.datetime.now().isoformat(),
            'file_size': 0,
            'status': 'pending'
        }
        os.makedirs(os.path.dirname(meta_path), exist_ok=True)
        with open(meta_path, 'w', encoding='utf-8') as meta_f:
            json.dump(meta_data, meta_f, indent=2, ensure_ascii=False)
            
        logger.info(f"Generated signed URL for direct upload: {unique_filename}")
        return jsonify({
            'uploadUrl': signed_url,
            'filename': unique_filename,
            'original_filename': filename
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating signed URL: {e}")
        return jsonify({'error': f"Failed to generate upload signed URL: {str(e)}"}), 500

@app.route('/api/upload/complete', methods=['POST'])
def upload_complete():
    """
    Called by frontend when direct GCS upload completes.
    Triggers metadata update and audio extraction.
    """
    data = request.json or {}
    filename = data.get('filename')
    
    if not filename:
        return jsonify({'error': 'filename is required'}), 400
        
    filepath = os.path.join(UPLOAD_FOLDER, filename)
    if not os.path.exists(filepath):
        logger.error(f"Upload complete notification failed: file not found at {filepath}")
        return jsonify({'error': f"File not found in storage: {filename}"}), 404
        
    base_name = filename.rsplit('.', 1)[0]
    meta_path = os.path.join(UPLOAD_FOLDER, f"{base_name}.meta.json")
    file_size = os.path.getsize(filepath)
    
    # Update metadata
    try:
        meta_data = {}
        if os.path.exists(meta_path):
            with open(meta_path, 'r', encoding='utf-8') as f:
                meta_data = json.load(f)
        
        meta_data['file_size'] = file_size
        meta_data['status'] = 'completed'
        
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta_data, f, indent=2, ensure_ascii=False)
            
        logger.info(f"Updated metadata for direct upload completion: {filename}")
    except Exception as e:
        logger.error(f"Failed to update metadata for {filename}: {e}")
        
    # Trigger audio extraction if it is a video
    file_ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
    if file_ext in {'mp4', 'webm'}:
        audio_filename = f"{base_name}.mp3"
        audio_filepath = os.path.join(UPLOAD_FOLDER, audio_filename)
        try:
            extract_audio_from_video(filepath, audio_filepath)
            logger.info(f"Audio extracted successfully from uploaded video: {audio_filename}")
        except Exception as e:
            logger.error(f"Failed to extract audio from video: {e}")
            return jsonify({'error': f"Audio extraction failed: {str(e)}"}), 500
            
    return jsonify({
        'message': 'File upload processed successfully',
        'filename': filename
    }), 200

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
    Groups sentences into slides/chunks and maps them to Remotion templates using timeline_service.
    Expects JSON body:
      - filename: base audio or video filename (e.g. sample.mp3, Sample.MP4)
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
        
    # Search for corresponding video file in uploads folder
    video_path = None
    for ext in ['mp4', 'webm', 'MP4', 'mkv', 'avi', 'mov']:
        p = os.path.join(UPLOAD_FOLDER, f"{base_name}.{ext}")
        if os.path.exists(p):
            video_path = p
            break
            
    try:
        timeline_payload = process_transcript_to_timeline(
            base_name=base_name,
            transcription_payload=transcription_payload,
            openrouter_model=openrouter_model,
            video_path=video_path
        )
        
        if not timeline_payload:
            return jsonify({'error': 'Timeline generation service failed. Check logs for details.'}), 500
            
        return jsonify({
            'message': 'AI Script analysis and timeline generation completed successfully',
            'timeline_file': f"{base_name}.json",
            'timeline': timeline_payload
        }), 200
        
    except Exception as e:
        logger.error(f"Error in analyze_script service execution: {e}", exc_info=True)
        return jsonify({'error': f'Timeline processing failed: {str(e)}'}), 500

@app.route('/api/render', methods=['POST'])
def render_video():
    """
    Spawns Remotion CLI or Modal serverless execution to render the dynamic Showcase composition.
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
    
    # 0. Check if GCP Parallel Rendering is enabled
    use_gcp_render = os.environ.get('USE_GCP_RENDER', 'false').lower() == 'true'
    
    if use_gcp_render:
        try:
            from gcp_render_scheduler import trigger_parallel_render
            logger.info(f"Triggering GCP Parallel Render for: {base_name}")
            success, result = trigger_parallel_render(base_name, timeline_path)
            
            if success:
                logger.info(f"GCP rendering completed successfully: {output_path}")
                return jsonify({
                    'message': 'Video rendered successfully on Google Cloud (Parallel)',
                    'rendered_file': result['rendered_file'],
                    'output_path': result['output_path']
                }), 200
            else:
                logger.error(f"GCP parallel rendering failed: {result}. Falling back...")
        except Exception as gcp_err:
            logger.error(f"GCP parallel rendering failed with exception: {gcp_err}. Falling back...")

    # 1. Check if Modal Rendering is enabled
    use_modal_render = os.environ.get('USE_MODAL_RENDER', 'false').lower() == 'true'
    
    if use_modal_render:
        try:
            import modal
            logger.info("Initializing Modal Volume connection...")
            vol = modal.Volume.from_name("video-editor-assets", create_if_missing=True)
            
            # Determine source file uploads
            local_video = os.path.join(UPLOAD_FOLDER, f"{base_name}.mp4")
            local_audio = os.path.join(UPLOAD_FOLDER, f"{base_name}.mp3")
            
            upload_video = False
            upload_audio = False
            
            # Check if video is already in the volume
            if os.path.exists(local_video):
                upload_video = True
                try:
                    entries = vol.listdir("uploads")
                    for entry in entries:
                        if entry.path in (f"uploads/{base_name}.mp4", f"{base_name}.mp4"):
                            logger.info(f"Video {base_name}.mp4 already exists in Modal Volume. Skipping upload.")
                            upload_video = False
                            break
                except Exception:
                    pass
            
            # Check if audio is already in the volume
            if os.path.exists(local_audio):
                upload_audio = True
                try:
                    entries = vol.listdir("uploads")
                    for entry in entries:
                        if entry.path in (f"uploads/{base_name}.mp3", f"{base_name}.mp3"):
                            logger.info(f"Audio {base_name}.mp3 already exists in Modal Volume. Skipping upload.")
                            upload_audio = False
                            break
                except Exception:
                    pass
            
            # Sync config and any missing media files
            logger.info("Uploading assets to Modal Volume...")
            with vol.batch_upload(force=True) as batch:
                # Upload timeline JSON configuration
                batch.put_file(timeline_path, f"timelines/{base_name}.json")
                if upload_video:
                    logger.info(f"Uploading {local_video} -> uploads/{base_name}.mp4")
                    batch.put_file(local_video, f"uploads/{base_name}.mp4")
                if upload_audio:
                    logger.info(f"Uploading {local_audio} -> uploads/{base_name}.mp3")
                    batch.put_file(local_audio, f"uploads/{base_name}.mp3")
            
            # Trigger remote render
            logger.info(f"Triggering remote render on Modal for: {base_name}")
            render_composition = modal.Function.from_name("video-renderer", "render_composition")
            rendered_res_filename = render_composition.remote(base_name)
            
            # Download output rendered file
            logger.info(f"Downloading rendered output from Modal Volume: renders/{rendered_res_filename}")
            with open(output_path, "wb") as f:
                for chunk in vol.read_file(f"renders/{rendered_res_filename}"):
                    f.write(chunk)
                    
            logger.info(f"Modal rendering completed successfully: {output_path}")
            return jsonify({
                'message': 'Video rendered successfully on Modal',
                'rendered_file': output_filename,
                'output_path': output_path
            }), 200
            
        except Exception as modal_err:
            logger.error(f"Modal rendering failed: {modal_err}. Falling back to local rendering...")
            # Fall through to local rendering if Modal fails
            
    # 2. Local rendering fallback
    video_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'video')
    logger.info(f"Starting local Remotion render for {base_name}...")
    logger.info(f"Props: {timeline_path}")
    logger.info(f"Output: {output_path}")
    
    cmd = f'npx remotion render Showcase "{output_path}" --props="{timeline_path}" --codec=h264 --x264-preset=veryfast'
    
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
                'message': 'Video rendered successfully (Local)',
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

@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """
    Scans uploads and correlates transcriptions, timelines, and renders into projects.
    """
    import json
    from datetime import datetime
    
    projects = {}
    
    # 1. Scan uploads for primary media and metadata
    if os.path.exists(UPLOAD_FOLDER):
        for fname in os.listdir(UPLOAD_FOLDER):
            # Ignore subdirectories and metadata files in initial sweep
            if os.path.isdir(os.path.join(UPLOAD_FOLDER, fname)) or fname.endswith('.meta.json') or fname.startswith('img_'):
                continue
                
            base_name, ext = os.path.splitext(fname)
            ext = ext.lower().lstrip('.')
            
            if ext in ALLOWED_EXTENSIONS:
                # Load metadata if exists
                meta_path = os.path.join(UPLOAD_FOLDER, f"{base_name}.meta.json")
                original_filename = fname
                uploaded_at = datetime.fromtimestamp(os.path.getmtime(os.path.join(UPLOAD_FOLDER, fname))).isoformat()
                file_size = os.path.getsize(os.path.join(UPLOAD_FOLDER, fname))
                
                if os.path.exists(meta_path):
                    try:
                        with open(meta_path, 'r', encoding='utf-8') as f:
                            meta = json.load(f)
                            original_filename = meta.get('original_filename', original_filename)
                            uploaded_at = meta.get('uploaded_at', uploaded_at)
                            file_size = meta.get('file_size', file_size)
                    except Exception as e:
                        logger.error(f"Error reading metadata for {fname}: {e}")
                
                # Determine type
                is_video = ext in {'mp4', 'webm'}
                proj_type = 'video' if is_video else 'audio'
                
                projects[base_name] = {
                    'id': base_name,
                    'filename': fname,
                    'original_filename': original_filename,
                    'uploaded_at': uploaded_at,
                    'file_size': file_size,
                    'type': proj_type,
                    'has_transcription': False,
                    'has_timeline': False,
                    'has_render': False,
                    'render_file': None
                }

    # 2. Check transcriptions
    if os.path.exists(TRANSCRIPTION_FOLDER):
        for fname in os.listdir(TRANSCRIPTION_FOLDER):
            if fname.endswith('.json'):
                base_name = os.path.splitext(fname)[0]
                if base_name in projects:
                    projects[base_name]['has_transcription'] = True
                    
    # 3. Check timelines
    if os.path.exists(TIMELINES_FOLDER):
        for fname in os.listdir(TIMELINES_FOLDER):
            if fname.endswith('.json'):
                base_name = os.path.splitext(fname)[0]
                if base_name in projects:
                    projects[base_name]['has_timeline'] = True
                    
    # 4. Check renders
    if os.path.exists(RENDER_FOLDER):
        for fname in os.listdir(RENDER_FOLDER):
            if fname.endswith('_rendered.mp4'):
                base_name = fname.replace('_rendered.mp4', '')
                if base_name in projects:
                    projects[base_name]['has_render'] = True
                    projects[base_name]['render_file'] = fname

    # Return list sorted by upload date (newest first)
    project_list = list(projects.values())
    project_list.sort(key=lambda x: x.get('uploaded_at', ''), reverse=True)
    return jsonify(project_list), 200

@app.route('/api/timeline/<base_name>', methods=['GET'])
def get_timeline(base_name):
    """
    Returns the timeline JSON content for a project.
    """
    import json
    timeline_path = os.path.join(TIMELINES_FOLDER, f"{base_name}.json")
    if not os.path.exists(timeline_path):
        # Fallback to current studio timeline if matching name
        studio_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'video', 'src', 'timeline.json')
        if os.path.exists(studio_path):
            try:
                with open(studio_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return jsonify(data), 200
            except Exception as e:
                return jsonify({'error': f'Failed to read studio timeline: {e}'}), 500
        return jsonify({'error': f'Timeline not found for {base_name}'}), 404
        
    try:
        with open(timeline_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return jsonify(data), 200
    except Exception as e:
        return jsonify({'error': f'Failed to read timeline: {e}'}), 500

@app.route('/api/timeline/<base_name>', methods=['POST'])
def save_timeline(base_name):
    """
    Saves the updated timeline JSON and copies it to the Remotion workspace for hot-reloading.
    """
    import json
    data = request.json
    if not data or 'timeline' not in data:
        return jsonify({'error': 'Invalid timeline payload. Must contain a timeline array.'}), 400
        
    timeline_path = os.path.join(TIMELINES_FOLDER, f"{base_name}.json")
    studio_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'video', 'src', 'timeline.json')
    
    try:
        # Save to project timelines folder
        with open(timeline_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        # Copy to Remotion src folder so Remotion Studio auto-refreshes
        with open(studio_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            
        logger.info(f"Successfully saved and synced timeline for {base_name}")
        return jsonify({'message': 'Timeline saved and synced successfully'}), 200
    except Exception as e:
        logger.error(f"Error saving timeline: {e}")
        return jsonify({'error': f'Failed to save timeline: {e}'}), 500

@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    """
    Saves an uploaded image to the uploads directory and copies it to
    the Remotion public folder so it can be resolved by staticFile().
    """
    if 'file' not in request.files:
        return jsonify({'error': 'No file part in the request'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    allowed_image_exts = {'png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'}
    file_ext = file.filename.rsplit('.', 1)[1].lower() if '.' in file.filename else ''
    
    if file_ext not in allowed_image_exts:
        return jsonify({'error': f'Image format not supported. Use: {", ".join(allowed_image_exts)}'}), 400
        
    # Generate unique name
    image_filename = f"img_{uuid.uuid4().hex}.{file_ext}"
    filepath = os.path.join(UPLOAD_FOLDER, image_filename)
    
    try:
        # Save to uploads folder
        file.save(filepath)
        
        # Copy to Remotion public uploads folder
        dest_path = os.path.join(VIDEO_PUBLIC_UPLOADS, image_filename)
        shutil.copy2(filepath, dest_path)
        
        logger.info(f"Custom image uploaded and copied: {image_filename} -> {dest_path}")
        
        return jsonify({
            'message': 'Image uploaded successfully',
            'filename': f"uploads/{image_filename}",
            'url': f"/uploads/{image_filename}"
        }), 200
    except Exception as e:
        logger.error(f"Failed to handle image upload: {e}")
        return jsonify({'error': f'Image upload failed: {e}'}), 500

if __name__ == '__main__':
    # Run Flask server locally
    app.run(host='127.0.0.1', port=5000, debug=True)
