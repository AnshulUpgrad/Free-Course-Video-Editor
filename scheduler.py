import os
import json
import time
import logging
import shutil
import tempfile
import subprocess
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
from google.cloud import storage

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_timeline_duration(timeline_data, fps=30):
    """
    Calculates total video duration in frames from the timeline structure.
    Matches the Root.tsx logic exactly.
    """
    total_frames = 0
    for slide in timeline_data.get('timeline', []):
        start_time = slide.get('startTime')
        if start_time is None:
            start_time = slide.get('start_time', 0)
            
        stop_time = slide.get('stopTime')
        if stop_time is None:
            stop_time = slide.get('stop_time')
        if stop_time is None:
            stop_time = slide.get('endTime')
        if stop_time is None:
            stop_time = slide.get('end_time')
        if stop_time is None:
            stop_time = start_time + 2
            
        duration = int(round((stop_time - start_time) * fps))
        total_frames += duration
    return total_frames

def get_gcs_client(sa_key_path=None):
    """Initializes GCS client with optional service account key path."""
    project_id = os.environ.get('GCP_PROJECT_ID')
    if project_id:
        os.environ['GOOGLE_CLOUD_PROJECT'] = project_id
        
    if sa_key_path and os.path.exists(sa_key_path):
        logger.info(f"Initializing GCS client with Service Account key: {sa_key_path}")
        return storage.Client.from_service_account_json(sa_key_path, project=project_id)
    else:
        logger.info(f"Initializing GCS client with Default Application Credentials for project: {project_id}")
        return storage.Client(project=project_id)

def get_auth_headers(service_url, sa_key_path=None):
    """Generates GCP ID token authorization header using service account key or local gcloud CLI."""
    headers = {'Content-Type': 'application/json'}
    
    # 1. Try Service Account key path first if provided
    if sa_key_path and os.path.exists(sa_key_path):
        try:
            from google.auth.transport.requests import Request
            from google.oauth2 import service_account
            
            logger.info(f"Generating ID token for audience: {service_url} using key {sa_key_path}")
            creds = service_account.IDTokenCredentials.from_service_account_file(
                sa_key_path, target_audience=service_url
            )
            creds.refresh(Request())
            headers['Authorization'] = f"Bearer {creds.token}"
            logger.info("Authorization header generated successfully using service account key.")
            return headers
        except Exception as e:
            logger.warning(f"Could not generate authentication header using service account key: {e}")

    # 2. Fall back to local gcloud CLI print-identity-token with service account impersonation
    try:
        project_id = os.environ.get('GCP_PROJECT_ID', 'upgrad-video-editor-remotion')
        sa_email = os.environ.get('GCP_SERVICE_ACCOUNT') or f"showcase-renderer-sa@{project_id}.iam.gserviceaccount.com"
        
        gcloud_path = "C:\\Users\\AnshulRoy\\AppData\\Local\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd"
        if not os.path.exists(gcloud_path):
            gcloud_path = "gcloud"  # Fallback to system path
            
        logger.info(f"Generating ID token using local gcloud CLI (impersonating {sa_email}) for audience: {service_url}")
        result = subprocess.run(
            [
                gcloud_path, "auth", "print-identity-token",
                f"--impersonate-service-account={sa_email}",
                f"--audiences={service_url}"
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            shell=True
        )
        if result.returncode == 0:
            token_output = result.stdout.strip()
            # Impersonated calls prefix with a WARNING line: "WARNING: This command is using..."
            # We take the last line which contains the raw JWT token.
            token_lines = token_output.splitlines()
            token = token_lines[-1].strip() if token_lines else ""
            headers['Authorization'] = f"Bearer {token}"
            logger.info("Authorization header generated successfully using local gcloud impersonation.")
        else:
            logger.warning(f"gcloud print-identity-token impersonation failed: {result.stderr.strip()}")
    except Exception as e:
        logger.warning(f"Failed to generate ID token via gcloud: {e}")
        
    return headers

def upload_if_changed(storage_client, bucket_name, local_path, gcs_path):
    """Uploads file to GCS only if it doesn't exist or size differs."""
    if not os.path.exists(local_path):
        raise FileNotFoundError(f"Local file not found: {local_path}")
        
    bucket = storage_client.bucket(bucket_name)
    blob = bucket.blob(gcs_path)
    
    if blob.exists():
        blob.reload()
        if blob.size == os.path.getsize(local_path):
            logger.info(f"Cache hit: {local_path} already exists in GCS at gs://{bucket_name}/{gcs_path} with matching size. Skipping upload.")
            return
            
    logger.info(f"Uploading {local_path} to gs://{bucket_name}/{gcs_path}...")
    blob.upload_from_filename(local_path)
    logger.info(f"Upload complete.")

def render_chunk_worker(service_url, headers, payload, chunk_index):
    """Worker thread target to POST a render request to Cloud Run with streaming progress."""
    url = f"{service_url.rstrip('/')}/render-chunk"
    
    # Stagger initial requests to avoid overwhelming Cloud Run with concurrent cold starts
    initial_delay = chunk_index * 2.0
    logger.info(f"[Chunk {chunk_index}] Staggering request by {initial_delay}s to avoid burst limits...")
    time.sleep(initial_delay)
    
    max_retries = 5
    backoff = 5
    
    for attempt in range(max_retries):
        logger.info(f"[Chunk {chunk_index}] Sending request (Attempt {attempt+1}/{max_retries}) to Cloud Run... Range: {payload['start_frame']}-{payload['end_frame']}")
        try:
            # 30 minute timeout for a single segment render, stream=True for real-time progress
            response = requests.post(url, json=payload, headers=headers, timeout=1800, stream=True)
            
            if response.status_code == 200:
                result_data = None
                # Read the streamed response line by line
                for line in response.iter_lines(decode_unicode=True):
                    if not line:
                        continue
                    if line.startswith("PROGRESS: "):
                        progress_msg = line[len("PROGRESS: "):]
                        logger.info(f"[Chunk {chunk_index}] {progress_msg}")
                    elif line.startswith("RESULT: "):
                        result_json = line[len("RESULT: "):]
                        result_data = json.loads(result_json)
                
                if result_data and result_data.get('status') == 'success':
                    logger.info(f"[Chunk {chunk_index}] Completed successfully. Output in GCS: {result_data.get('output_chunk_path')}")
                    return chunk_index, result_data.get('output_chunk_path'), result_data.get('rendered_frames', [])
                elif result_data and result_data.get('error'):
                    error_msg = result_data['error']
                    logger.error(f"[Chunk {chunk_index}] Worker returned error: {error_msg}")
                    if attempt == max_retries - 1:
                        raise RuntimeError(f"Cloud Run render failed for chunk {chunk_index}: {error_msg}")
                    logger.info(f"[Chunk {chunk_index}] Retrying in {backoff}s...")
                    time.sleep(backoff)
                    backoff *= 2
                else:
                    logger.error(f"[Chunk {chunk_index}] No RESULT line received from worker stream.")
                    if attempt == max_retries - 1:
                        raise RuntimeError(f"Cloud Run render failed for chunk {chunk_index}: No result received")
                    time.sleep(backoff)
                    backoff *= 2
            
            elif response.status_code == 429:
                logger.warning(f"[Chunk {chunk_index}] Rate limited (429: Rate exceeded) by Cloud Run. Retrying in {backoff}s...")
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Cloud Run render failed for chunk {chunk_index}: Rate limit (429) exceeded after {max_retries} attempts.")
                time.sleep(backoff)
                backoff *= 2
            
            else:
                logger.error(f"[Chunk {chunk_index}] Cloud Run returned error {response.status_code}: {response.text}")
                if attempt == max_retries - 1:
                    raise RuntimeError(f"Cloud Run render failed for chunk {chunk_index}: {response.text}")
                logger.info(f"[Chunk {chunk_index}] Retrying in {backoff}s...")
                time.sleep(backoff)
                backoff *= 2
                
        except requests.exceptions.RequestException as req_err:
            logger.warning(f"[Chunk {chunk_index}] Network connection failed: {req_err}")
            if attempt == max_retries - 1:
                raise req_err
            logger.info(f"[Chunk {chunk_index}] Retrying in {backoff}s...")
            time.sleep(backoff)
            backoff *= 2

    raise RuntimeError(f"Cloud Run render failed for chunk {chunk_index} after exhausting all {max_retries} attempts.")

def trigger_parallel_rendering(
    base_name,
    bucket_name,
    timeline_path,
    local_video_path,
    local_audio_path,
    total_frames,
    service_url,
    sa_key_path=None
):
    """
    Splits video into 10 chunks, uploads assets to GCS,
    and runs the 10 Cloud Run render jobs in parallel.
    """
    storage_client = get_gcs_client(sa_key_path)
    
    # Ensure bucket exists
    bucket = storage_client.bucket(bucket_name)
    if not bucket.exists():
        logger.info(f"Creating GCS bucket: {bucket_name}")
        storage_client.create_bucket(bucket_name)
        
    # 1. Sync input assets to GCS
    gcs_timeline_path = f"timelines/{base_name}.json"
    upload_if_changed(storage_client, bucket_name, timeline_path, gcs_timeline_path)
    
    gcs_video_path = None
    if local_video_path and os.path.exists(local_video_path):
        gcs_video_path = f"uploads/{os.path.basename(local_video_path)}"
        upload_if_changed(storage_client, bucket_name, local_video_path, gcs_video_path)
        
    gcs_audio_path = None
    if local_audio_path and os.path.exists(local_audio_path):
        gcs_audio_path = f"uploads/{os.path.basename(local_audio_path)}"
        upload_if_changed(storage_client, bucket_name, local_audio_path, gcs_audio_path)

    # 1.5 Extract and upload image assets from timeline to GCS
    try:
        with open(timeline_path, 'r', encoding='utf-8') as f:
            t_data = json.load(f)
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(timeline_path)))
        upload_dir = os.path.join(base_dir, 'uploads')
        for slide in t_data.get('timeline', []):
            img_path = slide.get('data', {}).get('image')
            if img_path and isinstance(img_path, str):
                img_name = os.path.basename(img_path)
                local_img_path = os.path.join(upload_dir, img_name)
                if os.path.exists(local_img_path):
                    gcs_img_path = f"uploads/{img_name}"
                    upload_if_changed(storage_client, bucket_name, local_img_path, gcs_img_path)
    except Exception as e:
        logger.warning(f"Failed to scan/upload timeline images to GCS: {e}")

    # 2. Divide frames into segments (capped by MAX_CONCURRENT_CHUNKS environment variable)
    max_chunks = int(os.environ.get('MAX_CONCURRENT_CHUNKS', 5))
    num_chunks = min(max_chunks, total_frames)
    if num_chunks <= 0:
        raise ValueError("Video has 0 frames. Cannot render.")
        
    chunk_size = total_frames // num_chunks
    chunks = []
    for i in range(num_chunks):
        start = i * chunk_size
        end = total_frames - 1 if i == num_chunks - 1 else (i + 1) * chunk_size - 1
        chunks.append((start, end))

    logger.info(f"Splitting video into {num_chunks} chunks for rendering. Total frames: {total_frames}")

    # 3. Generate authorization headers
    headers = get_auth_headers(service_url, sa_key_path)

    # 4. Trigger Cloud Run render instances concurrently
    chunk_paths = [None] * num_chunks
    all_rendered_frames = []
    futures = {}
    
    with ThreadPoolExecutor(max_workers=num_chunks) as executor:
        for idx, (start, end) in enumerate(chunks):
            output_chunk_path = f"renders/{base_name}_chunk_{idx}.mp4"
            payload = {
                "bucket_name": bucket_name,
                "video_path": gcs_video_path,
                "audio_path": gcs_audio_path,
                "timeline_path": gcs_timeline_path,
                "start_frame": start,
                "end_frame": end,
                "output_chunk_path": output_chunk_path
            }
            future = executor.submit(
                render_chunk_worker, service_url, headers, payload, idx
            )
            futures[future] = idx

        for future in as_completed(futures):
            idx = futures[future]
            try:
                chunk_idx, gcs_chunk_path, rendered_frames = future.result()
                chunk_paths[chunk_idx] = gcs_chunk_path
                all_rendered_frames.extend(rendered_frames)
            except Exception as e:
                logger.error(f"Error rendering chunk {idx}: {e}")
                # Cancel other pending futures if one fails
                executor.shutdown(wait=False, cancel_futures=True)
                raise e

    return chunk_paths, all_rendered_frames

def concatenate_chunks_locally(storage_client, bucket_name, gcs_chunk_paths, local_output_path):
    """
    Downloads rendered chunks from GCS and stitches them locally using FFmpeg.
    """
    temp_dir = tempfile.mkdtemp(prefix="stitch_")
    bucket = storage_client.bucket(bucket_name)
    
    local_chunk_paths = []
    try:
        # 1. Download all chunks
        for idx, gcs_path in enumerate(gcs_chunk_paths):
            local_chunk_path = os.path.join(temp_dir, f"chunk_{idx}.mp4")
            logger.info(f"Downloading chunk {idx}: gs://{bucket_name}/{gcs_path} -> {local_chunk_path}")
            blob = bucket.blob(gcs_path)
            blob.download_to_filename(local_chunk_path)
            local_chunk_paths.append(local_chunk_path)

        # 2. Write the concatenation text file
        concat_file_path = os.path.join(temp_dir, "concat.txt")
        with open(concat_file_path, "w") as f:
            for path in local_chunk_paths:
                # FFmpeg concat demuxer expects forward slashes and escaped paths
                safe_path = path.replace("\\", "/")
                f.write(f"file '{safe_path}'\n")

        # 3. Stitch chunks using FFmpeg
        logger.info(f"Stitching {len(local_chunk_paths)} chunks to output path: {local_output_path}")
        
        # Ensure parent folder of output path exists
        os.makedirs(os.path.dirname(os.path.abspath(local_output_path)), exist_ok=True)
        
        cmd = [
            "ffmpeg", "-y", "-f", "concat", "-safe", "0",
            "-i", concat_file_path, "-c", "copy", local_output_path
        ]
        
        result = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=300
        )
        
        if result.returncode != 0:
            logger.error(f"FFmpeg stitch failed with exit code {result.returncode}")
            logger.error(result.stderr)
            raise RuntimeError(f"FFmpeg concatenation failed: {result.stderr}")
            
        logger.info("FFmpeg stitch completed successfully.")

    finally:
        # Clean up temporary local files
        try:
            shutil.rmtree(temp_dir, ignore_errors=True)
        except Exception:
            pass

def clean_up_gcs_chunks(storage_client, bucket_name, gcs_chunk_paths):
    """Deletes temporary rendered chunk videos from GCS."""
    bucket = storage_client.bucket(bucket_name)
    for gcs_path in gcs_chunk_paths:
        try:
            logger.info(f"Cleaning up temporary GCS chunk: gs://{bucket_name}/{gcs_path}")
            bucket.delete_blob(gcs_path)
        except Exception as e:
            logger.warning(f"Failed to delete GCS blob {gcs_path}: {e}")

def run_cloudrun_render(
    base_name,
    timeline_path,
    local_video_path,
    local_audio_path,
    local_output_path,
    bucket_name,
    service_url,
    sa_key_path=None
):
    """
    Main entry point for GCP Cloud Run rendering pipeline.
    """
    logger.info("Starting GCP Cloud Run parallel rendering process...")
    
    # 1. Parse timeline to get duration
    with open(timeline_path, 'r', encoding='utf-8') as f:
        timeline_data = json.load(f)
        
    total_frames = get_timeline_duration(timeline_data)
    
    # 2. Trigger parallel rendering on Cloud Run
    gcs_chunk_paths, rendered_frames = trigger_parallel_rendering(
        base_name=base_name,
        bucket_name=bucket_name,
        timeline_path=timeline_path,
        local_video_path=local_video_path,
        local_audio_path=local_audio_path,
        total_frames=total_frames,
        service_url=service_url,
        sa_key_path=sa_key_path
    )
    
    # 3. Stitch chunks locally
    storage_client = get_gcs_client(sa_key_path)
    concatenate_chunks_locally(storage_client, bucket_name, gcs_chunk_paths, local_output_path)
    
    # 4. Clean up GCS chunks (optional, keep it enabled to save space/cost)
    clean_up_gcs_chunks(storage_client, bucket_name, gcs_chunk_paths)
    
    # 5. Generate and write frame render audit
    rendered_set = set(rendered_frames)
    expected_frames = set(range(total_frames))
    missing_frames = sorted(list(expected_frames - rendered_set))
    
    audit_data = {
        'base_name': base_name,
        'total_expected_frames': total_frames,
        'rendered_count': len(rendered_set),
        'missing_count': len(missing_frames),
        'rendered_frames': sorted(list(rendered_set)),
        'missing_frames': missing_frames,
        'status': 'complete' if len(missing_frames) == 0 else 'incomplete'
    }
    
    audit_path = os.path.join(os.path.dirname(local_output_path), f"{base_name}_audit.json")
    try:
        with open(audit_path, 'w', encoding='utf-8') as f:
            json.dump(audit_data, f, indent=2)
        logger.info(f"GCP Cloud Run frame render audit completed. Status: {audit_data['status']}. Missing: {audit_data['missing_count']} frames.")
    except Exception as e:
        logger.error(f"Failed to write frame audit file: {e}")
        
    logger.info("GCP Cloud Run parallel rendering complete.")
