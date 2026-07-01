# 🐍 Backend Code: `app.py`

`app.py` is the main Flask application that serves as the backend Web API. It handles HTTP requests from the frontend, manages the local filesystem database, and coordinates transcription, analysis, and rendering queues.

---

## 🛠️ Configuration & Global Variables

### 📂 Directory Constants
The app uses absolute paths to ensure reliability:
- **`UPLOAD_FOLDER`**: Stores uploaded raw user files (`uploads/`).
- **`TRANSCRIPTION_FOLDER`**: Stores JSON outputs from the transcription step (`transcriptions/`).
- **`TIMELINES_FOLDER`**: Stores the output timeline JSONs from the LLM director (`timelines/`).
- **`VIDEO_PUBLIC_UPLOADS`**: The public upload directory inside the Remotion project (`video/public/uploads/`).
- **`RENDER_FOLDER`**: Stores final stitched MP4 video files and frame audits (`renders/`).
- **`PROMPTS_FOLDER`**: Location of system prompts for LLM planning (`prompts/`).

---

## 🔍 Function Implementations

### 1. `allowed_file(filename)`
- **Purpose**: Validates input file extensions before processing.
- **Parameters**: `filename` (str)
- **Returns**: Boolean
- **Details**: Checks if file extension is present in `ALLOWED_EXTENSIONS` (`{mp3, wav, m4a, flac, webm, mp4}`).

### 2. `extract_audio_from_video(video_path, audio_path)`
- **Purpose**: Extracts the audio track from a video file using system `ffmpeg`.
- **Parameters**: `video_path` (str), `audio_path` (str)
- **Returns**: Boolean indicating success
- **Execution Command**:
  ```bash
  ffmpeg -y -i <video_path> -vn -acodec libmp3lame -ar 44100 -ac 2 -b:a 192k <audio_path>
  ```

### 3. `split_transcript_into_sentences(transcription_payload)`
- **Purpose**: Groups word-level Whisper segments into coherent sentences based on punctuation.
- **Parameters**: `transcription_payload` (dict)
- **Returns**: List of sentences (dict) containing:
  - `index` (int)
  - `start` (float)
  - `end` (float)
  - `text` (str)
- **Logic**: Iterates over all words. Accumulates words until it encounters a word ending with `.`, `!`, or `?`. Splitting this way ensures visual slides match natural punctuation breaks. Falls back to segment-level boundaries if word timestamps are missing.

### 4. `parse_rendered_frames(log_content)`
- **Purpose**: Parses verbose Remotion console logs to track frame rendering.
- **Parameters**: `log_content` (str)
- **Returns**: List of unique rendered frame indices (sorted ints).
- **Details**: Uses Regex: `\[FRAME_RENDER\]\s+["\']*(\d+)`.

### 5. `generate_frame_audit(base_name, total_frames, rendered_frames)`
- **Purpose**: Compares rendered frame indices with expected frames to generate a quality-control audit report.
- **Parameters**: `base_name` (str), `total_frames` (int), `rendered_frames` (list)
- **Returns**: Audit summary dictionary.
- **File Output**: Writes a report to `renders/{base_name}_audit.json` containing:
  - `total_expected_frames`
  - `rendered_count`
  - `missing_count`
  - `rendered_frames` (list)
  - `missing_frames` (list)
  - `status` (`"complete"` if missing count is 0, else `"incomplete"`)

---

## 🌐 HTTP Endpoint Handlers

### 📤 `/api/upload` (POST)
- **Logic**: Saves multi-part form parameter `file` into `uploads/` with a unique UUID filename to avoid name collisions.
- **Metadata**: Generates `<uuid>.meta.json` recording original file name, size, and timestamp.

### 📝 `/api/transcribe` (POST)
- **Payload**: `{"filename": "...", "model_size": "base"}`
- **Logic**:
  1. Checks if video. If yes, extracts audio via `extract_audio_from_video`.
  2. Executes transcription using 3-step fallbacks:
     - **Pathway A**: Invokes native serverless Modal `WhisperTranscriber` function client.
     - **Pathway B**: POSTs to external HTTP endpoint (`MODAL_TRANSCRIBE_URL`).
     - **Pathway C**: Runs local `faster_whisper` on host CPU.
  3. Saves Whisper payload to `transcriptions/{base_name}.json`.

### 🧠 `/api/analyze` (POST)
- **Payload**: `{"filename": "...", "model": "..."}`
- **Logic**:
  1. Reads transcription JSON.
  2. Invokes `process_transcript_to_timeline` from `timeline_service.py` to chunk the audio and call the OpenRouter Gemini API.
  3. Returns the generated timeline config.

### 🎬 `/api/render` (POST)
- **Payload**: `{"filename": "..."}`
- **Logic**:
  1. Looks up `timelines/{base_name}.json`.
  2. Dispatches rendering using enabled pipelines:
     - **Google Cloud Run**: Runs parallel chunks via `scheduler.run_cloudrun_render`.
     - **Modal**: Volumes files and triggers `video-renderer` serverless function.
     - **Local CLI Fallback**: Spawns Remotion CLI locally:
       ```bash
       npx.cmd remotion render Showcase Showcase.mp4 --props=timeline.json --codec=h264
       ```
  3. Audits the frames and returns the output download path.

### 📊 `/api/projects` (GET)
- **Logic**: Scans directory logs to correlate raw uploads, transcriptions, timeline files, and renders. Returns a sorted project list (newest first).

### ⚙️ `/api/timeline/<base_name>` (GET)
- **Logic**: Returns the active timeline configurations JSON. Falls back to studio config if not found.

---
- **Next Deep Dive**: [[process.py]] / [[timeline_service.py]]
- **Go Back**: [[Backend API & Services]] / [[Welcome]]
