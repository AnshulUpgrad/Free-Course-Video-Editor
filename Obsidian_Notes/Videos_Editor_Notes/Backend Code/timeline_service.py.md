# 🧠 Backend Code: `timeline_service.py`

`timeline_service.py` contains the core AI orchestrator that acts as the "Video Director". It handles sentence extraction, communicates with the LLM API, and aligns visual card intervals with the timeline.

---

## 🔍 Core Function Implementations

### 1. `load_system_prompt(filename='video_director.md')`
- **Purpose**: Reads instructions defining how the LLM should segment scripts and choose templates.
- **Parameters**: `filename` (str)
- **Returns**: Stripped system prompt text content.

### 2. `split_transcript_into_sentences(transcription_payload)`
- **Purpose**: Reconstructs words into sentences with start/end timestamps.
- **Parameters**: `transcription_payload` (dict)
- **Returns**: List of sentences (dict)
- **Logic**: Refer to [[app.py#3. split_transcript_into_sentences(transcription_payload)]].

### 3. `analyze_script(sentences, openrouter_model='google/gemini-2.5-flash')`
- **Purpose**: Performs a structured LLM call via the OpenRouter API.
- **Parameters**: `sentences` (list), `openrouter_model` (str)
- **Returns**: Decoded JSON layout timeline array plan or `None` on failure.
- **Details**:
  1. Requests OpenRouter completion using the `google/gemini-2.5-flash` model.
  2. Injects system instructions via the message payload: `{"role": "system", "content": system_prompt}`.
  3. Forces JSON output responses using `"response_format": {"type": "json_object"}`.
  4. Parses the returned raw text and strips markdown wrapper tags (` ```json ... ``` `).

### 4. `build_timeline_segments(analysis_result, sentences, total_duration)`
- **Purpose**: Takes LLM indices and snaps boundaries to timestamps, calculating frame ranges.
- **Parameters**: `analysis_result` (dict), `sentences` (list), `total_duration` (float)
- **Returns**: List of configured timeline slides (dict) containing:
  - `templateId` (str)
  - `durationInFrames` (int)
  - `startTime` (float)
  - `endTime` (float)
  - `data` (dict)
- **Logic**:
  - The LLM returns a start sentence index (`start_sentence_index`) and end sentence index (`end_sentence_index`).
  - The function retrieves the sentence timestamps: `startTime = sentences[start_sentence_index]['start']` and `endTime = sentences[end_sentence_index]['end']`.
  - For the very first chunk ($i = 0$), forces `startTime = 0.0`.
  - For successive chunks, snaps `startTime` to the previous slide's `endTime` to eliminate visual gaps.
  - For the final chunk, forces `endTime = total_duration`.
  - Computes duration: `duration = endTime - startTime` (safeguarded at `max(0.5, duration)`).
  - Computes frame length: `duration_in_frames = int(duration * 30)`.

### 5. `process_transcript_to_timeline(base_name, transcription_payload, ...)`
- **Purpose**: Master coordinator function mapping raw transcripts to Remotion assets.
- **Steps**:
  1. Calls `split_transcript_into_sentences`.
  2. Queries `analyze_script` to get visual layout schedules.
  3. Evaluates total duration.
  4. Runs `build_timeline_segments`.
  5. Syncs files to Remotion directories:
     - Copies local source audio (`uploads/{base_name}.mp3`) to Remotion's public folders (`video/public/uploads/{base_name}.mp3`).
     - Copies local source video (if present) to `video/public/uploads/{base_name}.mp4` and inserts standard relative JSON paths `"videoUrl": "uploads/{base_name}.mp4"`.
  6. Saves timeline configurations to `timelines/{base_name}.json` and updates the Remotion Studio preview config at `video/src/timeline.json`.

---
- **Next Deep Dive**: [[scheduler.py]] / [[worker.py]]
- **Go Back**: [[Backend API & Services]] / [[Welcome]]
