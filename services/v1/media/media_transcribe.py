# Copyright (c) 2025 Stephen G. Pope
#
# This program is free software; you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation; either version 2 of the License, or
# (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License along
# with this program; if not, write to the Free Software Foundation, Inc.,
# 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.



import os
from faster_whisper import WhisperModel
import srt
from datetime import timedelta
from services.file_management import download_file
import logging
from config import LOCAL_STORAGE_PATH

# Set up logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def process_transcribe_media(media_url, task, include_text, include_srt, include_segments, word_timestamps, response_type, language, job_id, words_per_line=None):
    """Transcribe or translate media and return the transcript/translation, SRT or VTT file path."""
    logger.info(f"Starting {task} for media URL: {media_url}")
    input_filename = download_file(media_url, os.path.join(LOCAL_STORAGE_PATH, f"{job_id}_input"))
    logger.info(f"Downloaded media to local file: {input_filename}")

    try:
        # Load faster-whisper model with int8 quantization for CPU
        model_size = "large-v3-turbo"
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        logger.info(f"Loaded Faster-Whisper {model_size} model with int8 quantization")

        # Configure transcription/translation options for faster-whisper
        transcribe_options = {
            "task": task,
            "word_timestamps": word_timestamps
        }

        # Add language specification if provided
        if language:
            transcribe_options["language"] = language

        # faster-whisper returns (segments, info) tuple
        segments_generator, info = model.transcribe(input_filename, **transcribe_options)
        
        # Convert generator to list and build result dict compatible with old format
        segments_list = []
        full_text_parts = []
        
        for segment in segments_generator:
            segment_dict = {
                'start': segment.start,
                'end': segment.end,
                'text': segment.text
            }
            
            # Add word timestamps if requested
            if word_timestamps and hasattr(segment, 'words') and segment.words:
                segment_dict['words'] = [
                    {
                        'word': word.word,
                        'start': word.start,
                        'end': word.end
                    }
                    for word in segment.words
                ]
            
            segments_list.append(segment_dict)
            full_text_parts.append(segment.text)
        
        # Build result dict compatible with old whisper format
        result = {
            'text': ''.join(full_text_parts),
            'segments': segments_list,
            'language': info.language
        }
        
        # For translation task, the result['text'] will be in English
        text = None
        srt_text = None
        segments_json = None

        logger.info(f"Generated {task} output")

        if include_text is True:
            text = result['text']

        if include_srt is True:
            srt_subtitles = []
            subtitle_index = 1
            
            if words_per_line and words_per_line > 0:
                # Collect all words and their timings
                all_words = []
                word_timings = []
                
                for segment in result['segments']:
                    words = segment['text'].strip().split()
                    segment_start = segment['start']
                    segment_end = segment['end']
                    
                    # Calculate timing for each word
                    if words:
                        duration_per_word = (segment_end - segment_start) / len(words)
                        for i, word in enumerate(words):
                            word_start = segment_start + (i * duration_per_word)
                            word_end = word_start + duration_per_word
                            all_words.append(word)
                            word_timings.append((word_start, word_end))
                
                # Process words in chunks of words_per_line
                current_word = 0
                while current_word < len(all_words):
                    # Get the next chunk of words
                    chunk = all_words[current_word:current_word + words_per_line]
                    
                    # Calculate timing for this chunk
                    chunk_start = word_timings[current_word][0]
                    chunk_end = word_timings[min(current_word + len(chunk) - 1, len(word_timings) - 1)][1]
                    
                    # Create the subtitle
                    srt_subtitles.append(srt.Subtitle(
                        subtitle_index,
                        timedelta(seconds=chunk_start),
                        timedelta(seconds=chunk_end),
                        ' '.join(chunk)
                    ))
                    subtitle_index += 1
                    current_word += words_per_line
            else:
                # Original behavior - one subtitle per segment
                for segment in result['segments']:
                    start = timedelta(seconds=segment['start'])
                    end = timedelta(seconds=segment['end'])
                    segment_text = segment['text'].strip()
                    srt_subtitles.append(srt.Subtitle(subtitle_index, start, end, segment_text))
                    subtitle_index += 1
            
            srt_text = srt.compose(srt_subtitles)

        if include_segments is True:
            segments_json = result['segments']

        os.remove(input_filename)
        logger.info(f"Removed local file: {input_filename}")
        logger.info(f"{task.capitalize()} successful, output type: {response_type}")

        if response_type == "direct":
            return text, srt_text, segments_json, result.get('language')
        else:
            
            if include_text is True:
                text_filename = os.path.join(LOCAL_STORAGE_PATH, f"{job_id}.txt")
                with open(text_filename, 'w') as f:
                    f.write(text)
            else:
                text_file = None
            
            if include_srt is True:
                srt_filename = os.path.join(LOCAL_STORAGE_PATH, f"{job_id}.srt")
                with open(srt_filename, 'w') as f:
                    f.write(srt_text)
            else:
                srt_filename = None

            if include_segments is True:
                segments_filename = os.path.join(LOCAL_STORAGE_PATH, f"{job_id}.json")
                with open(segments_filename, 'w') as f:
                    f.write(str(segments_json))
            else:
                segments_filename = None

            return text_filename, srt_filename, segments_filename, result.get('language')

    except Exception as e:
        logger.error(f"{task.capitalize()} failed: {str(e)}")
        raise