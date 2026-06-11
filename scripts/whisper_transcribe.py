#!/usr/bin/env python3
"""Bridge script: calls faster-whisper and outputs JSON transcript to stdout."""

import json
import sys
import os

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: whisper_transcribe.py <audio_file> [model_size]"}), file=sys.stderr)
        sys.exit(1)

    audio_path = sys.argv[1]
    model_size = sys.argv[2] if len(sys.argv) > 2 else "base"

    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print(json.dumps({"error": "faster-whisper not installed. Run: pip install faster-whisper"}), file=sys.stderr)
        sys.exit(1)

    model = WhisperModel(model_size, device="auto", compute_type="auto")

    segments, info = model.transcribe(audio_path, word_timestamps=True, vad_filter=True)

    result = {
        "language": info.language,
        "duration": info.duration,
        "segments": [],
    }

    for seg in segments:
        seg_dict = {
            "start": round(seg.start, 3),
            "end": round(seg.end, 3),
            "text": seg.text.strip(),
            "words": [],
        }
        if seg.words:
            for w in seg.words:
                seg_dict["words"].append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                    "probability": round(w.probability, 3),
                })
        result["segments"].append(seg_dict)

    print(json.dumps(result))
    sys.exit(0)


if __name__ == "__main__":
    main()
