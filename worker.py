import os
import sys
import re
import uuid
import shutil
import logging
import subprocess
import json
from flask import Flask, request, jsonify, Response
from google.cloud import storage

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Initialize GCS client
storage_client = storage.Client()

VIDEO_DIR = "/app/video"
PUBLIC_UPLOADS_DIR = os.path.join(VIDEO_DIR, "public", "uploads")

# Ensure uploads directory exists
os.makedirs(PUBLIC_UPLOADS_DIR, exist_ok=True)

def download_from_gcs(bucket_name, source_blob_name, destination_file_name):
    """Downloads a blob from the bucket."""
    logger.info(f"Downloading gs://{bucket_name}/{source_blob_name} to {destination_file_name}...")
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(source_blob_name)
    
    # Ensure parent directory exists
    os.makedirs(os.path.dirname(destination_file_name), exist_ok=True)
    
    blob.download_to_filename(destination_file_name)
    logger.info(f"Downloaded gs://{bucket_name}/{source_blob_name} successfully.")

def upload_to_gcs(bucket_name, source_file_name, destination_blob_name):
    """Uploads a file to the bucket."""
    logger.info(f"Uploading {source_file_name} to gs://{bucket_name}/{destination_blob_name}...")
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(destination_blob_name)
    blob.upload_from_filename(source_file_name)
    logger.info(f"Uploaded successfully to gs://{bucket_name}/{destination_blob_name}.")

@app.route('/render-chunk', methods=['POST'])
def render_chunk():
    """
    Renders a specific frame range of the Showcase composition.
    Expected JSON payload:
      - bucket_name: GCS bucket name
      - video_path: GCS path to raw video (optional)
      - audio_path: GCS path to raw audio (optional)
      - timeline_path: GCS path to timeline JSON (required)
      - start_frame: start frame of the range (required)
      - end_frame: end frame of the range (required)
      - output_chunk_path: GCS path where the rendered chunk should be uploaded
    """
    data = request.json or {}
    bucket_name = data.get('bucket_name')
    video_path = data.get('video_path')
    audio_path = data.get('audio_path')
    timeline_path = data.get('timeline_path')
    start_frame = data.get('start_frame')
    end_frame = data.get('end_frame')
    output_chunk_path = data.get('output_chunk_path')

    if not bucket_name or not timeline_path or start_frame is None or end_frame is None or not output_chunk_path:
        return jsonify({'error': 'Missing required parameters'}), 400

    # Create a unique working directory for this request's temp files
    run_id = uuid.uuid4().hex
    temp_dir = f"/tmp/render_{run_id}"
    os.makedirs(temp_dir, exist_ok=True)

    try:
        # 1. Download the timeline JSON
        local_timeline_path = os.path.join(temp_dir, "timeline.json")
        download_from_gcs(bucket_name, timeline_path, local_timeline_path)

        # 2. Download the media assets (video/audio) directly to Remotion's public folder
        if video_path:
            video_filename = os.path.basename(video_path)
            local_video_target = os.path.join(PUBLIC_UPLOADS_DIR, video_filename)
            # Only download if it doesn't exist (shared cache optimization across runs)
            if not os.path.exists(local_video_target):
                logger.info(f"Cache miss for video. Downloading to public path: {local_video_target}")
                download_from_gcs(bucket_name, video_path, local_video_target)
            else:
                logger.info(f"Cache hit for video: {local_video_target}. Skipping download.")

        if audio_path:
            audio_filename = os.path.basename(audio_path)
            local_audio_target = os.path.join(PUBLIC_UPLOADS_DIR, audio_filename)
            # Only download if it doesn't exist
            if not os.path.exists(local_audio_target):
                logger.info(f"Cache miss for audio. Downloading to public path: {local_audio_target}")
                download_from_gcs(bucket_name, audio_path, local_audio_target)
            else:
                logger.info(f"Cache hit for audio: {local_audio_target}. Skipping download.")

        # 2.5 Extract and download image assets from timeline to Remotion's public uploads folder
        try:
            with open(local_timeline_path, 'r', encoding='utf-8') as f:
                t_data = json.load(f)
            for slide in t_data.get('timeline', []):
                img_path = slide.get('data', {}).get('image')
                if img_path and isinstance(img_path, str):
                    img_name = os.path.basename(img_path)
                    local_img_target = os.path.join(PUBLIC_UPLOADS_DIR, img_name)
                    # Only download if it doesn't exist
                    if not os.path.exists(local_img_target):
                        gcs_img_path = f"uploads/{img_name}"
                        logger.info(f"Cache miss for image. Downloading to public path: {local_img_target}")
                        download_from_gcs(bucket_name, gcs_img_path, local_img_target)
                    else:
                        logger.info(f"Cache hit for image: {local_img_target}. Skipping download.")
        except Exception as img_err:
            logger.error(f"Failed to download image assets: {img_err}")

        # 3. Perform the Remotion render with streaming progress
        local_output_path = os.path.join(temp_dir, "chunk.mp4")
        
        # Build command. We use swangle GL since Cloud Run lacks a physical GPU display.
        cmd = [
            "npx", "remotion", "render", "Showcase", local_output_path,
            f"--props={local_timeline_path}",
            f"--frames={start_frame}-{end_frame}",
            "--for-seamless-aac-concatenation",
            "--codec=h264",
            "--x264-preset=veryfast",
            "--gl=swangle",
            "--overwrite",
            "--log=verbose"
        ]

        logger.info(f"Executing Remotion command: {' '.join(cmd)}")
        
        def generate_stream():
            """Generator that streams Remotion progress line-by-line, then yields final result."""
            process = subprocess.Popen(
                cmd,
                cwd=VIDEO_DIR,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            
            rendered_frames = set()
            
            # Stream each stdout line as a progress event
            for line in process.stdout:
                stripped = line.strip()
                if stripped:
                    logger.info(f"Remotion: {stripped}")
                    matches = re.findall(r'\[FRAME_RENDER\]\s+["\']*(\d+)', stripped)
                    for m in matches:
                        rendered_frames.add(int(m))
                    yield f"PROGRESS: {stripped}\n"
            
            process.wait()
            
            if process.returncode != 0:
                error_msg = f"Remotion render failed with exit code {process.returncode}"
                logger.error(error_msg)
                yield f"RESULT: {json.dumps({'error': error_msg, 'returncode': process.returncode})}\n"
                return
            
            # 4. Upload the rendered chunk to GCS
            try:
                upload_to_gcs(bucket_name, local_output_path, output_chunk_path)
                result_payload = {
                    'status': 'success', 
                    'start_frame': start_frame, 
                    'end_frame': end_frame, 
                    'output_chunk_path': output_chunk_path,
                    'rendered_frames': sorted(list(rendered_frames))
                }
                yield "RESULT: " + json.dumps(result_payload) + "\n"
            except Exception as upload_err:
                logger.error(f"Failed to upload chunk to GCS: {upload_err}")
                yield f"RESULT: {json.dumps({'error': f'GCS upload failed: {str(upload_err)}'})}\n"
            finally:
                # Clean up temp directory after render + upload is complete
                try:
                    shutil.rmtree(temp_dir, ignore_errors=True)
                    logger.info(f"Cleaned up temp directory: {temp_dir}")
                except Exception as cleanup_err:
                    logger.warning(f"Failed to clean up temp directory {temp_dir}: {cleanup_err}")
        
        return Response(generate_stream(), mimetype='text/plain', status=200)

    except Exception as e:
        logger.error(f"Unhandled exception during render: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy'}), 200

if __name__ == '__main__':
    # Cloud Run expects the server to listen on PORT environment variable
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
