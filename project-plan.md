# Skate — AI-Powered YouTube → Shorts CLI

> Convert long-form YouTube videos and podcasts into viral-ready short-form content, entirely on your local machine.

---

## What It Does

Skate takes a YouTube URL (or a local video file), and automatically produces upload-ready vertical Shorts — complete with subtitles, thumbnails, and metadata.

**One command in:**

```bash
skate https://youtube.com/watch?v=abc123
```

**Organized output:**

```
output/
├── clips/
│   ├── clip-01.mp4
│   ├── clip-02.mp4
│   └── clip-03.mp4
├── captions/
│   ├── clip-01.srt
│   └── clip-02.srt
├── thumbnails/
│   ├── clip-01.jpg
│   └── clip-02.jpg
├── metadata.json
└── report.md
```

---

## How It Works — The Pipeline

Each video flows through a fixed sequence of steps:

```
1. Download           — Pull video from YouTube (or accept a local file)
2. Extract Audio      — Strip audio track for transcription
3. Transcribe         — Convert speech to text with word-level timestamps
4. Chunk Transcript   — Split into 30–90 second segments
5. Heuristic Scoring  — Score each chunk locally (fast, no AI needed)
6. AI Ranking         — Send top chunks to an LLM for virality scoring
7. Clip Selection     — Pick the best clips based on combined scores
8. Face Tracking      — Detect and track faces for smart vertical framing
9. Generate Crop Data — Smooth the crop path for every frame
10. Render Clips       — Cut video, apply crop, burn subtitles
11. Export             — Write final files + metadata
```

---

## Technology Stack

| Component | Tool | Why |
|---|---|---|
| Runtime | **Bun** | Fast startup, native TypeScript, great CLI tooling |
| UI | **Ink + React** | Progress bars, interactive menus, real-time logs |
| Video Download | **yt-dlp** | Supports YouTube, playlists, channels, Shorts |
| Speech Recognition | **faster-whisper** | Local transcription with word-level timestamps |
| Computer Vision | **OpenCV** | Scene detection, motion analysis, blur detection |
| Face Tracking | **MediaPipe** | Real-time multi-face detection and landmark tracking |
| AI / LLM | **Ollama** (`qwen3:8b`) | Local LLM for virality scoring and metadata generation |
| Video Processing | **FFmpeg** | Cutting, cropping, subtitle burn-in, thumbnail export |

> **Important:** Ollama is never used for transcription or generating timestamps — only for ranking and metadata.

---

## Project Structure

```
skate/
├── src/
│   ├── commands/          # CLI entry points
│   │   ├── clip.ts        # Main clip command
│   │   ├── analyze.ts     # Analysis only (no render)
│   │   ├── render.ts      # Render from existing analysis
│   │   ├── watch.ts       # Watch folder for new files
│   │   └── doctor.ts      # Check dependencies
│   │
│   ├── core/              # Processing pipeline
│   │   ├── downloader.ts
│   │   ├── transcriber.ts
│   │   ├── chunker.ts
│   │   ├── scorer.ts
│   │   ├── ranker.ts
│   │   ├── tracker.ts
│   │   ├── renderer.ts
│   │   └── subtitles.ts
│   │
│   ├── ai/                # LLM integration
│   │   ├── prompts.ts
│   │   ├── ollama.ts
│   │   └── ranking.ts
│   │
│   ├── vision/            # Computer vision
│   │   ├── face.ts
│   │   ├── scene.ts
│   │   └── crop.ts
│   │
│   └── ui/                # Terminal UI components
│       ├── app.tsx
│       ├── progress.tsx
│       ├── table.tsx
│       └── logs.tsx
│
├── output/                # Final exported clips
├── cache/                 # Cached downloads + transcripts
├── models/                # Local whisper/ollama models
└── temp/                  # Intermediate working files
```

---

## Transcript Chunking

After transcription, the transcript is split into segments of **30–90 seconds** each.

**Chunk format:**

```json
{
  "start": 120,
  "end": 180,
  "text": "The biggest mistake most people make is..."
}
```

**Chunking rules:**
- Break on natural pauses and silences
- Break on topic shifts or speaker changes
- Never cut mid-sentence
- Preserve complete thoughts

---

## Heuristic Scoring (Before AI)

Every chunk gets a score from 0–100 based on five signals. This runs fast and locally — no LLM needed.

| Signal | What It Detects | Weight |
|---|---|---|
| **Speaking Rate** | Increased pace = higher engagement | 15% |
| **Emotional Language** | Words like *secret, mistake, never, million* | 20% |
| **Sentiment Shift** | Strong positive/negative swings | 15% |
| **Story Structure** | Patterns: *problem → conflict → lesson → surprise* | 25% |
| **Engagement Hooks** | Phrases like *"did you know", "here's why", "what happened next"* | 25% |

Only the top-scoring chunks are sent to the AI for deeper analysis.

---

## AI Ranking

The LLM evaluates the top heuristic candidates and returns a ranked list.

**Scoring criteria:**
- Hook strength — does it grab attention immediately?
- Virality potential — will people share this?
- Curiosity — does it make you want to keep watching?
- Emotional impact — does it make you feel something?
- Shareability — would someone send this to a friend?

**Output format:**

```json
[
  {
    "title": "The biggest mistake beginners make",
    "score": 9.7,
    "start": 0,
    "end": 45,
    "reason": "Strong hook, relatable failure story, clear lesson at the end"
  }
]
```

---

## Clip Selection Rules

| Rule | Value |
|---|---|
| Minimum length | 20 seconds |
| Maximum length | 90 seconds |
| Ideal range | 30–60 seconds |

**Automatically rejected:**
- Dead air or long silences
- Repeated content
- Incomplete stories
- Clips that start or end mid-sentence

---

## Face Tracking & Vertical Reframing

For every frame of a selected clip, Skate detects and tracks faces to generate a smooth crop path.

**Per-frame output:**

```json
{
  "timestamp": 12.4,
  "centerX": 940,
  "centerY": 400
}
```

**Reframing rules (target: 1080×1920):**

| Scenario | Crop Behavior |
|---|---|
| Single speaker | Keep face centered |
| Two speakers | Dynamic split — follow active speaker |
| No face detected | Center crop |

Movement is smoothed to avoid jarring camera jumps.

---

## Subtitle Engine

Subtitles are generated from word-level timestamps and burned into the video.

**Output format (SRT):**

```srt
1
00:00:01,000 --> 00:00:03,000
This is insane
```

**Available styles** (V1 ships with Minimal):

| Style | Description |
|---|---|
| Minimal | Clean, simple text |
| TikTok | Bold, centered, high-contrast |
| MrBeast | Animated, emphatic |
| Podcast | Subtler, lower-third style |

---

## Metadata Per Clip

Every exported clip includes a metadata block:

```json
{
  "title": "The biggest mistake beginners make",
  "hook": "Most people get this completely wrong...",
  "hashtags": ["#productivity", "#mistakes", "#growth"],
  "score": 9.7,
  "duration": 47
}
```

---

## CLI Commands

### `skate clip` — Process a local video

```bash
skate clip video.mp4
```

Full pipeline: transcribe → analyze → render.

---

### `skate youtube` — Download and process a YouTube video

```bash
skate youtube https://youtube.com/watch?v=abc123
```

---

### `skate analyze` — Score without rendering

```bash
skate analyze video.mp4
```

Runs the full analysis pipeline and shows rankings, but doesn't produce any video files.

---

### `skate render` — Render from saved analysis

```bash
skate render video.mp4
```

Skips re-analysis and uses previously cached results. Useful for tweaking render settings.

---

### `skate watch` — Auto-process a folder

```bash
skate watch ./videos
```

Watches a directory and automatically processes any new video files dropped into it.

---

### `skate doctor` — Check dependencies

```bash
skate doctor
```

Verifies that FFmpeg, yt-dlp, Ollama, and Whisper are installed and reachable.

---

## Configuration

Config file lives at `~/.skate/config.json`.

```json
{
  "model": "qwen3:8b",
  "clips": 10,
  "minLength": 20,
  "maxLength": 90,
  "subtitleStyle": "minimal"
}
```

---

## Caching

Skate caches intermediate results at `~/.skate/cache` so reruns are fast and work offline.

Cached items:
- Downloaded video/audio
- Transcripts
- Face tracking data
- Analysis results

---

## Performance Targets (M4 Mac, 1-hour podcast)

| Step | Target Time |
|---|---|
| Download | 1–3 min |
| Transcribe | 2–5 min |
| Analysis | < 30 sec |
| Render | 3–5 min |
| **Total** | **< 15 min** |

---

## Testing Plan

| Test Type | Coverage |
|---|---|
| Unit | Transcript parsing, chunking logic, scoring, ranking |
| Integration | Full pipeline with YouTube input and local file input |
| Regression | Known podcast dataset with expected clip scores |

---

## Release Roadmap

| Version | Features |
|---|---|
| **0.1** | Download, Whisper transcription, FFmpeg cuts |
| **0.2** | AI ranking, metadata generation |
| **0.3** | Face tracking, vertical exports |
| **0.4** | TUI, watch mode |
| **1.0** | Stable CLI, cross-platform support, Homebrew install, public release |

**Planned for V2:** Speaker tracking, thumbnail generation, auto titles & hashtags, batch processing, watch folders.

**Planned for V3:** Auto B-roll, AI editing, social upload integrations, multi-language support.
