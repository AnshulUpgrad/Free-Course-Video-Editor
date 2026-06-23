import os
import json
import shutil
import logging
import requests
from dotenv import load_dotenv

# Configure logging
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
TRANSCRIPTION_FOLDER = os.path.join(BASE_DIR, 'transcriptions')
TIMELINES_FOLDER = os.path.join(BASE_DIR, 'timelines')
VIDEO_PUBLIC_UPLOADS = os.path.join(BASE_DIR, 'video', 'public', 'uploads')
PROMPTS_FOLDER = os.path.join(BASE_DIR, 'prompts')

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(TRANSCRIPTION_FOLDER, exist_ok=True)
os.makedirs(TIMELINES_FOLDER, exist_ok=True)
os.makedirs(VIDEO_PUBLIC_UPLOADS, exist_ok=True)
os.makedirs(PROMPTS_FOLDER, exist_ok=True)


def load_system_prompt(filename='video_director.md'):
    """Loads the video director system prompt from prompts folder."""
    prompt_path = os.path.join(PROMPTS_FOLDER, filename)
    with open(prompt_path, 'r', encoding='utf-8') as f:
        return f.read().strip()


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


def analyze_script(sentences, openrouter_model='google/gemini-2.5-flash'):
    """
    Calls the OpenRouter Gemini API to chunk sentences and map them to templates.
    """
    openrouter_key = os.environ.get('OPENROUTER_API_KEY')
    if not openrouter_key:
        logger.error("OPENROUTER_API_KEY environment variable is not set")
        return None

    try:
        system_prompt = load_system_prompt('video_director.md')
    except Exception as e:
        logger.error(f"Failed to load system prompt: {e}")
        return None

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
            return None
            
        result_json = response.json()
        raw_content = result_json['choices'][0]['message']['content'].strip()
        
        if raw_content.startswith("```json"):
            raw_content = raw_content[7:]
        if raw_content.endswith("```"):
            raw_content = raw_content[:-3]
        raw_content = raw_content.strip()
        
        return json.loads(raw_content)
    except Exception as e:
        logger.error(f"Failed to communicate with or parse response from OpenRouter: {e}")
        return None


def build_timeline_segments(analysis_result, sentences, total_duration):
    """
    Snaps segment boundaries to sentence boundaries and calculates frame durations.
    """
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
        
    return timeline_segments


def process_transcript_to_timeline(base_name, transcription_payload, openrouter_model='google/gemini-2.5-flash', video_path=None):
    """
    Coordinates sentence splitting, LLM analysis, and timeline building.
    Also handles copying the assets (audio, video) to the Remotion public uploads folder.
    """
    # 1. Split into sentences
    sentences = split_transcript_into_sentences(transcription_payload)
    if not sentences:
        logger.error("No sentences extracted from transcription.")
        return None
        
    # 2. Call LLM to plan the visual chunks
    analysis_result = analyze_script(sentences, openrouter_model=openrouter_model)
    if not analysis_result:
        logger.error("LLM script analysis failed.")
        return None

    # 3. Calculate total duration
    total_duration = transcription_payload.get('duration', 0.0)
    if total_duration == 0.0:
        total_duration = sentences[-1]['end'] if sentences else 0.0

    # 4. Build segments
    timeline_segments = build_timeline_segments(analysis_result, sentences, total_duration)

    # 5. Handle asset copy: Audio File
    src_audio_path = os.path.join(UPLOAD_FOLDER, f"{base_name}.mp3")
    audio_ext = "mp3"
    if not os.path.exists(src_audio_path):
        for ext in ['wav', 'm4a', 'flac']:
            if os.path.exists(os.path.join(UPLOAD_FOLDER, f"{base_name}.{ext}")):
                src_audio_path = os.path.join(UPLOAD_FOLDER, f"{base_name}.{ext}")
                audio_ext = ext
                break

    dest_audio_filename = f"{base_name}.{audio_ext}"
    dest_audio_path = os.path.join(VIDEO_PUBLIC_UPLOADS, dest_audio_filename)

    if os.path.exists(src_audio_path):
        try:
            shutil.copy2(src_audio_path, dest_audio_path)
            logger.info(f"Copied audio to Remotion public uploads: {dest_audio_path}")
        except Exception as e:
            logger.error(f"Failed to copy audio to Remotion public uploads: {e}")
    else:
        logger.warning(f"Source audio file not found, cannot copy to Remotion public uploads: {src_audio_path}")

    # 6. Handle asset copy: Video File
    dest_video_filename = None
    if video_path and os.path.exists(video_path):
        video_filename = os.path.basename(video_path)
        dest_video_path = os.path.join(VIDEO_PUBLIC_UPLOADS, video_filename)
        try:
            shutil.copy2(video_path, dest_video_path)
            logger.info(f"Copied video to Remotion public uploads: {dest_video_path}")
            dest_video_filename = f"uploads/{video_filename}"
        except Exception as e:
            logger.error(f"Failed to copy video to Remotion public uploads: {e}")

    # 7. Construct final timeline payload
    timeline_payload = {
        "audioUrl": f"uploads/{dest_audio_filename}",
        "timeline": timeline_segments
    }
    if dest_video_filename:
        timeline_payload["videoUrl"] = dest_video_filename
    else:
        # Check if there is an existing video file in public uploads matching the name
        # to preserve videoUrl linking.
        possible_video = os.path.join(VIDEO_PUBLIC_UPLOADS, f"{base_name}.MP4")
        if not os.path.exists(possible_video):
            possible_video = os.path.join(VIDEO_PUBLIC_UPLOADS, f"{base_name}.mp4")
            
        if os.path.exists(possible_video):
            timeline_payload["videoUrl"] = f"uploads/{os.path.basename(possible_video)}"

    # 8. Save output timeline JSON config
    output_filename = f"{base_name}.json"
    output_path = os.path.join(TIMELINES_FOLDER, output_filename)
    
    with open(output_path, 'w', encoding='utf-8') as out_f:
        json.dump(timeline_payload, out_f, indent=2, ensure_ascii=False)
        
    logger.info(f"Saved timeline mapping to {output_path}")

    # 9. Write directly to video/src/timeline.json for the Remotion Studio preview to pick it up
    studio_timeline_path = os.path.join(BASE_DIR, 'video', 'src', 'timeline.json')
    try:
        with open(studio_timeline_path, 'w', encoding='utf-8') as studio_f:
            json.dump(timeline_payload, studio_f, indent=2, ensure_ascii=False)
        logger.info(f"Copied timeline config to Remotion Studio preview: {studio_timeline_path}")
    except Exception as e:
        logger.error(f"Failed to copy timeline config to Remotion Studio preview: {e}")

    return timeline_payload
