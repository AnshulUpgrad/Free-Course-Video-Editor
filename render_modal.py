import os
import subprocess
import shutil
import modal

# Define the persistent volume for uploads, timelines, and outputs
volume = modal.Volume.from_name("video-editor-assets", create_if_missing=True)

# Build the Docker image with Node, Chromium dependencies, and FFmpeg
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(
        "ffmpeg",
        "curl",
        "wget",
        "gnupg",
        # Chromium / Puppeteer system libraries
        "libnss3",
        "libnspr4",
        "libatk1.0-0",
        "libatk-bridge2.0-0",
        "libcups2",
        "libdrm2",
        "libxkbcommon0",
        "libxcomposite1",
        "libxdamage1",
        "libxrandr2",
        "libgbm1",
        "libasound2",
        "fonts-liberation",
        "libxshmfence1",
        "libglu1-mesa",
    )
    # Install Node.js v20
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs",
    )
    # Bundle the local Remotion React project into the container
    .add_local_dir("./video", "/root/video", copy=True, ignore=["node_modules", "package-lock.json"])
    # Install npm packages inside the container
    .run_commands("cd /root/video && npm install")
)

app = modal.App("video-renderer", image=image)

@app.function(
    volumes={"/root/assets": volume},
    cpu=8.0,
    memory=16384,
    timeout=600,
)
def render_composition(base_name: str) -> str:
    video_dir = "/root/video"
    timeline_path = f"/root/assets/timelines/{base_name}.json"
    output_filename = f"{base_name}_rendered.mp4"
    output_temp_path = f"/tmp/{output_filename}"
    output_vol_path = f"/root/assets/renders/{output_filename}"
    
    if not os.path.exists(timeline_path):
        raise FileNotFoundError(f"Timeline config not found at {timeline_path}")
        
    # Sync matching media files from the mounted volume into the Remotion public directory
    container_public_uploads = os.path.join(video_dir, "public", "uploads")
    os.makedirs(container_public_uploads, exist_ok=True)
    
    # We check if there's a video file or audio file matching base_name
    source_mp4 = f"/root/assets/uploads/{base_name}.mp4"
    source_mp3 = f"/root/assets/uploads/{base_name}.mp3"
    
    if os.path.exists(source_mp4):
        shutil.copy2(source_mp4, os.path.join(container_public_uploads, f"{base_name}.mp4"))
    if os.path.exists(source_mp3):
        shutil.copy2(source_mp3, os.path.join(container_public_uploads, f"{base_name}.mp3"))
        
    # Remotion render command
    # Using gl=swangle because headless cloud instances usually lack active GPU displays
    cmd = (
        f"npx remotion render Showcase \"{output_temp_path}\" "
        f"--props=\"{timeline_path}\" "
        f"--codec=h264 --x264-preset=veryfast --gl=swangle --overwrite"
    )
    
    print(f"Executing: {cmd}")
    
    process = subprocess.Popen(
        cmd,
        shell=True,
        cwd=video_dir,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    # Print the output in real-time to Modal logs
    for line in iter(process.stdout.readline, ""):
        print(line.strip())
        
    process.stdout.close()
    return_code = process.wait()
    
    if return_code != 0:
        raise RuntimeError(f"Remotion render failed with exit code {return_code}")
        
    os.makedirs(os.path.dirname(output_vol_path), exist_ok=True)
    shutil.copy2(output_temp_path, output_vol_path)
    
    volume.commit()
    
    return output_filename
