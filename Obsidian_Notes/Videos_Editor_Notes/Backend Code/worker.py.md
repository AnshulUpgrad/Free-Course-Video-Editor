# 🐍 Backend Code: `worker.py` & `render_modal.py`

These files define the remote execution environments where the Remotion engine runs in a headless environment.

---

## 🐋 Cloud Run Worker (`worker.py`)

`worker.py` is a lightweight Flask service packaged inside a Docker container. It listens for render requests, pulls assets from GCS, and runs the Remotion CLI.

### 🌐 Endpoint: `/render-chunk` (POST)
When triggered by the scheduler, the worker performs the following steps:

1. **Working Directory Creation**: Generates a temporary sandbox path `/tmp/render_<uuid>/`.
2. **Asset Download**:
   - Downloads `timeline.json` configuration from GCS.
   - Downloads raw MP4/MP3 files into Remotion's public folder `/app/video/public/uploads/`.
   - **Cache Optimization**: Checks if assets already exist in the container volume directory before downloading, saving egress costs.
3. **Headless Execution**:
   - Spawns the Remotion CLI with command arguments:
     - `--frames=<start>-<end>`: Renders only the designated slice.
     - `--gl=swangle`: Utilizes headless software GL rendering (avoids needing a physical graphics display).
     - `--for-seamless-aac-concatenation`: Aligns audio boundaries for stitch compatibility.
4. **Streaming Progress**:
   - Uses a generator to stream Remotion stdout (`[FRAME_RENDER] ...` progress events) in real-time back to the scheduler client.
5. **GCS Upload**:
   - Uploads the finished slice MP4 to the GCS bucket (`renders/`).
   - Yields a final `"RESULT: ..."` JSON payload containing the frame list and file location.
6. **Cleanup**: Deletes temporary sandbox files.

---

## ☁️ Modal Serverless Deployment (`render_modal.py`)

`render_modal.py` defines a serverless execution flow using **Modal**. It enables running Whisper or Remotion without local dependencies.

### 📦 Container Environment Image definition
Modal builds a custom Docker image dynamically inside its registry:
```python
image = (
    modal.Image.debian_slim(python_version="3.10")
    .apt_install(
        "ffmpeg", "curl", "wget", "gnupg",
        # Puppeteer system dependencies for chrome rendering
        "libnss3", "libnspr4", "libatk1.0-0", "libatk-bridge2.0-0",
        "libcups2", "libdrm2", "libxkbcommon0", "libxcomposite1",
        "libxdamage1", "libxrandr2", "libgbm1", "libasound2",
        "fonts-liberation", "libxshmfence1", "libglu1-mesa"
    )
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs"
    )
    .add_local_dir("./video", "/root/video", copy=True)
    .run_commands("cd /root/video && npm install")
)
```

### 🧠 Serverless Function: `render_composition`
- **Resources**: Configured with `cpu=8.0`, `memory=16384` (16GB RAM), and a 10-minute timeout.
- **Persistent Volume**: Mounts the Modal shared volume `video-editor-assets` at `/root/assets`.
- **Workflow**:
  1. Copies matching uploads (e.g., `<name>.mp4` or `<name>.mp3`) from the persistent assets folder directly into `/root/video/public/uploads/`.
  2. Spawns Remotion CLI: `npx remotion render Showcase ... --gl=swangle`.
  3. Parses stdout for `[FRAME_RENDER]` lines.
  4. Generates a frame audit report.
  5. Commits the output MP4 and audit JSON back to the assets volume.

---
- **Next Deep Dive**: [[Root & Showcase]]
- **Go Back**: [[Backend API & Services]] / [[Welcome]]
