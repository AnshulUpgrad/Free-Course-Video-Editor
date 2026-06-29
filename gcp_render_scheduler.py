import os
import json
import subprocess
import concurrent.futures
import requests
import logging
import math

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VIDEO_DIR = os.path.join(BASE_DIR, 'video')

is_cloud_run = os.environ.get('K_SERVICE') is not None
write_base_dir = '/app/gcs' if is_cloud_run else BASE_DIR

TIMELINES_FOLDER = os.path.join(write_base_dir, 'timelines')
RENDER_FOLDER = os.path.join(write_base_dir, 'renders')
UPLOAD_FOLDER = os.path.join(write_base_dir, 'uploads')

FPS = 30
TARGET_CHUNK_DURATION_SEC = 20
TARGET_CHUNK_FRAMES = TARGET_CHUNK_DURATION_SEC * FPS

def get_composition_duration(timeline_path):
    """
    Computes total duration in frames based on timeline JSON file.
    """
    with open(timeline_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    timeline = data.get('timeline', [])
    total_frames = 0
    for slide in timeline:
        duration_frames = slide.get('durationInFrames')
        if duration_frames is None:
            # Fallback
            start = slide.get('startTime', 0)
            end = slide.get('endTime', start + 2)
            duration_frames = int((end - start) * FPS)
        total_frames += duration_frames
    
    return total_frames or 1335  # default fallback if empty

def calculate_chunks(total_frames, chunk_size=TARGET_CHUNK_FRAMES):
    """
    Splits total frames into range segments.
    """
    chunks = []
    num_chunks = math.ceil(total_frames / chunk_size)
    for i in range(num_chunks):
        start = i * chunk_size
        end = min((i + 1) * chunk_size - 1, total_frames - 1)
        chunks.append({
            "index": i,
            "start": start,
            "end": end
        })
    return chunks

def render_chunk(chunk, serve_url, service_name, region, timeline_path, temp_props_path):
    """
    Triggers Node script to render a single chunk on GCP.
    """
    index = chunk["index"]
    start = chunk["start"]
    end = chunk["end"]
    
    out_name = f"chunks/chunk_{index}.mp4"
    
    cmd = [
        "node",
        os.path.join(VIDEO_DIR, "render-chunk.js"),
        f"--props={temp_props_path}",
        f"--start={start}",
        f"--end={end}",
        f"--serveUrl={serve_url}",
        f"--service={service_name}",
        f"--region={region}",
        f"--out={out_name}"
    ]
    
    logger.info(f"Rendering chunk {index} (frames {start}-{end}) using command: {' '.join(cmd)}")
    
    try:
        result = subprocess.run(cmd, cwd=VIDEO_DIR, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        # Parse output URL from stdout
        gcs_url = None
        for line in result.stdout.splitlines():
            if line.startswith("RENDER_SUCCESS_URL="):
                gcs_url = line.split("RENDER_SUCCESS_URL=")[1].strip()
                break
        
        if gcs_url:
            logger.info(f"Chunk {index} rendered successfully: {gcs_url}")
            return index, gcs_url
        else:
            logger.error(f"Chunk {index} rendered but output URL not found in stdout: {result.stdout}")
            raise RuntimeError(f"Output URL not found for chunk {index}")
            
    except subprocess.CalledProcessError as e:
        logger.error(f"Chunk {index} rendering failed (code {e.returncode}): {e.stderr}")
        raise

def download_file(url, local_path):
    """
    Downloads a file via HTTP.
    """
    logger.info(f"Downloading {url} to {local_path}...")
    response = requests.get(url, stream=True)
    response.raise_for_status()
    with open(local_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)

def trigger_parallel_render(base_name, timeline_path):
    """
    Main orchestration logic for parallel rendering on GCP.
    """
    # 1. Load config from environment variables
    serve_url = os.environ.get("REMOTION_SERVE_URL")
    service_name = os.environ.get("REMOTION_SERVICE_NAME")
    region = os.environ.get("REMOTION_GCP_REGION", "us-east1")
    
    if not serve_url or not service_name:
        return False, "REMOTION_SERVE_URL and REMOTION_SERVICE_NAME environment variables must be set."
    
    # Check timeline path
    if not os.path.exists(timeline_path):
        return False, f"Timeline path not found: {timeline_path}"
        
    # Read the timeline to calculate durations
    total_frames = get_composition_duration(timeline_path)
    chunks = calculate_chunks(total_frames)
    
    logger.info(f"Starting parallel render for {base_name}: total {total_frames} frames, {len(chunks)} chunks.")
    
    # 2. Pass timeline path directly as props path for the runner
    temp_props_path = timeline_path
    
    # 3. Render chunks in parallel using thread pool
    chunk_urls = [None] * len(chunks)
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(chunks)) as executor:
        futures = {
            executor.submit(render_chunk, chunk, serve_url, service_name, region, timeline_path, temp_props_path): chunk
            for chunk in chunks
        }
        
        for future in concurrent.futures.as_completed(futures):
            chunk = futures[future]
            try:
                index, url = future.result()
                chunk_urls[index] = url
            except Exception as e:
                logger.error(f"Parallel rendering failed at chunk {chunk['index']}: {e}")
                return False, f"Chunk {chunk['index']} failed: {str(e)}"
                
    logger.info("All chunks rendered successfully. Preparing for stitching...")
    
    # 4. Stitch chunks using FFmpeg
    # Create temp directory for stitching
    temp_dir = os.path.join(RENDER_FOLDER, f"temp_{base_name}")
    os.makedirs(temp_dir, exist_ok=True)
    
    local_chunks = []
    try:
        # Download all chunk MP4s locally to the temp directory
        for i, url in enumerate(chunk_urls):
            local_chunk_path = os.path.join(temp_dir, f"chunk_{i}.mp4")
            download_file(url, local_chunk_path)
            local_chunks.append(local_chunk_path)
            
        # Create concat file
        concat_file_path = os.path.join(temp_dir, "concat.txt")
        with open(concat_file_path, "w", encoding="utf-8") as f:
            for chunk_path in local_chunks:
                # FFmpeg requires forward slashes or escaped backslashes in concat file
                safe_path = chunk_path.replace("\\", "/")
                f.write(f"file '{safe_path}'\n")
                
        # Determine master audio track path if it exists
        with open(timeline_path, 'r', encoding='utf-8') as f:
            timeline_data = json.load(f)
        
        audio_rel_url = timeline_data.get("audioUrl", "")
        audio_filename = os.path.basename(audio_rel_url) if audio_rel_url else ""
        master_audio_path = os.path.join(UPLOAD_FOLDER, audio_filename) if audio_filename else ""
        
        output_filename = f"{base_name}_rendered.mp4"
        output_path = os.path.join(RENDER_FOLDER, output_filename)
        
        # Build FFmpeg command
        if audio_filename and os.path.exists(master_audio_path):
            logger.info(f"Master audio track found at {master_audio_path}. Merging with video chunks...")
            cmd = [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file_path,
                "-i", master_audio_path,
                "-c:v", "copy",
                "-c:a", "aac",
                "-map", "0:v",
                "-map", "1:a",
                output_path
            ]
        else:
            logger.info("No master audio track found. Stitching video chunks only...")
            cmd = [
                "ffmpeg", "-y",
                "-f", "concat",
                "-safe", "0",
                "-i", concat_file_path,
                "-c", "copy",
                output_path
            ]
            
        logger.info(f"Running stitching command: {' '.join(cmd)}")
        subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, check=True)
        logger.info("Stitching completed successfully.")
        
        return True, {
            "rendered_file": output_filename,
            "output_path": output_path
        }
        
    except Exception as e:
        logger.error(f"Stitching failed: {e}")
        return False, f"Stitching failed: {str(e)}"
        
    finally:
        # Cleanup temp directory
        try:
            import shutil
            shutil.rmtree(temp_dir, ignore_errors=True)
            logger.info(f"Cleaned up temp directory: {temp_dir}")
        except Exception as cleanup_err:
            logger.warning(f"Failed to clean up temp directory: {cleanup_err}")
