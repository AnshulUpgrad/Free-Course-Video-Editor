# 🐍 Backend Code: `scheduler.py`

`scheduler.py` coordinates the high-performance parallel rendering workflow. It splits render requests across concurrent instances on GCP Cloud Run, manages files in GCP Cloud Storage (GCS), and stitches finished segments.

---

## 🔍 Function Implementations

### 1. `get_timeline_duration(timeline_data, fps=30)`
- **Purpose**: Calculates the total frame duration of the video based on configured slide boundaries.
- **Parameters**: `timeline_data` (dict), `fps` (int)
- **Returns**: Total frame count (int).
- **Details**: Sums the rounded frame difference of each slide's stop time and start time. Matches frontend calculation in `Root.tsx` frame-for-frame.

### 2. `get_gcs_client(sa_key_path=None)`
- **Purpose**: Initializes a GCP storage client.
- **Parameters**: `sa_key_path` (str, optional)
- **Returns**: GCS client object.
- **Details**: Uses `storage.Client.from_service_account_json` if a key path is provided, otherwise falls back to Default Application Credentials.

### 3. `get_auth_headers(service_url, sa_key_path=None)`
- **Purpose**: Obtains a secure OpenID Connect ID token for GCP Cloud Run authentication.
- **Parameters**: `service_url` (str), `sa_key_path` (str, optional)
- **Returns**: Request headers dict (`{'Authorization': 'Bearer <token>', ...}`).
- **Logic**:
  - **Option 1**: Uses `google.auth` and `google.oauth2.service_account` to sign and exchange an ID token dynamically targeting the worker service audience URL.
  - **Option 2**: CLI Fallback via `gcloud` subprocess:
    ```bash
    gcloud auth print-identity-token --impersonate-service-account=<sa> --audiences=<service_url>
    ```

### 4. `upload_if_changed(storage_client, bucket_name, local_path, gcs_path)`
- **Purpose**: Syncs assets to GCS while minimizing unnecessary network traffic.
- **Parameters**: `storage_client`, `bucket_name` (str), `local_path` (str), `gcs_path` (str)
- **Details**: Checks if the file size on GCS matches the local size. If yes, skips the upload (cache hit).

### 5. `render_chunk_worker(service_url, headers, payload, chunk_index)`
- **Purpose**: Dispatches render requests to GCP Cloud Run and monitors progress.
- **Parameters**: `service_url` (str), `headers` (dict), `payload` (dict), `chunk_index` (int)
- **Returns**: Tuple `(chunk_index, gcs_chunk_path, rendered_frames_list)`
- **Retry Logic**:
  - Leverages exponential backoff retries (up to 5 attempts) to absorb container cold starts or network drops.
  - Handles rate limiting status (`429`) with dynamic sleep delays.
  - Parses streaming responses: prints `"PROGRESS: ..."` lines and extracts final `"RESULT: ..."` JSON.

### 6. `trigger_parallel_rendering(...)`
- **Purpose**: splits the timeline, uploads files, and triggers parallel rendering workers.
- **Parameters**: `base_name` (str), `bucket_name` (str), `timeline_path` (str), `local_video_path` (str), `local_audio_path` (str), `total_frames` (int), `service_url` (str), `sa_key_path` (str)
- **Returns**: List of GCS chunk paths, and combined list of rendered frames.
- **Logic**:
  - Calculates frame splits: divides `total_frames` into equal sections based on `MAX_CONCURRENT_CHUNKS` (default: 5).
  - Starts a `ThreadPoolExecutor` and spawns `render_chunk_worker` for each segment concurrently.

### 7. `concatenate_chunks_locally(storage_client, bucket_name, gcs_chunk_paths, local_output_path)`
- **Purpose**: Downloads individual rendered chunks from GCS and stitches them.
- **Steps**:
  1. Downloads all MP4 chunks from GCS to a temporary folder (`stitch_xxxx`).
  2. Generates an FFmpeg compatible list file:
     ```text
     file '/tmp/stitch_xxxx/chunk_0.mp4'
     file '/tmp/stitch_xxxx/chunk_1.mp4'
     ```
  3. Executes FFmpeg copy demuxer to stitch chunks instantly:
     ```bash
     ffmpeg -y -f concat -safe 0 -i concat.txt -c copy <local_output_path>
     ```

### 8. `run_cloudrun_render(...)`
- **Purpose**: Main entry point for Cloud Run pipeline. Coordinates GCS connection, parallel rendering, chunk stitching, storage cleanup, and frame render auditing.

---
- **Next Deep Dive**: [[worker.py]] / [[render_modal.py]]
- **Go Back**: [[Backend API & Services]] / [[Welcome]]
