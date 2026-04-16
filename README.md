# Frame to Video — Figma Plugin

Export Figma frames as animated 1080p videos with background video, music, and element animations.

## Installation

1. In Figma, go to **Plugins → Development → Import plugin from manifest…**
2. Select the `manifest.json` from this folder
3. The plugin appears under Plugins → Development → Frame to Video

## How to Use

### 1. Load a Frame
- Select a single **Frame** in Figma (works with Components/Instances too)
- Click **"Load Selected Frame"** — the plugin exports every direct child as a high-res PNG

### 2. Configure Animations
- Click any element in the left panel to select it
- Choose an animation type:
  - **Fade In** — opacity 0→1
  - **Slide from Left/Right/Top/Bottom** — element slides in with fade
  - **Scale In** — element scales from 30% to 100% with fade
  - **Text Reveal →** — progressive left-to-right clip reveal (great for headlines/copy)
- Set **Start** time (when the animation begins in the video)
- Set **Duration** (how long the animation takes)
- Set **Distance** (pixel offset for slide animations)
- Choose an **Easing** curve
- Click **"Apply to Element"** or **"Apply to All"** (auto-staggers at 0.15s intervals)

### 3. Add Background Media
- **Background Video**: Drag & drop or click to upload any video file — plays behind all elements, fills the frame (cover mode), with adjustable opacity
- **Background Audio**: Drag & drop any audio file for the soundtrack — muxed into the final export with volume control

### 4. Preview
- Use ▶ / ⏸ to play/pause
- Click anywhere on the timeline bar to scrub
- Adjust **Duration** in the right panel to change total video length

### 5. Export
- Set your target resolution (1080p default), frame rate (30fps default), and quality
- Click **"Export Video"** — the plugin renders every frame and downloads the result
- If your browser supports MP4 export (recent Chrome/Figma desktop), it'll auto-detect; otherwise exports WebM

## Architecture

```
manifest.json     → Plugin config
code.js           → Figma main thread: reads frame, exports children as PNGs
ui.html           → Plugin UI (all-in-one):
                      ├── Animation engine (easing, state calc per frame)
                      ├── Canvas renderer (composites bg video + elements)
                      ├── Playback controller (real-time preview)
                      ├── Media loader (video/audio via Blob URLs)
                      └── Export engine (Canvas.captureStream → MediaRecorder)
```

## Technical Notes

- **Elements are exported at 2x scale** from Figma for crisp rendering, drawn at 1x size on canvas
- **Export uses MediaRecorder API** — no external dependencies, runs entirely in-browser
- **Audio muxing** uses AudioContext → MediaStreamDestination to combine audio + video streams
- **Frame-accurate rendering**: Export loop renders each frame sequentially with `setTimeout` yields
- **MP4 support**: Auto-detected via `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')` — available on recent Chromium builds (Figma desktop). Falls back to VP9 WebM.
- **No external dependencies** — everything is vanilla JS, no npm/build step required

## Limitations & Future Improvements

- **Nested frames**: Currently only reads direct children of the selected frame. Deep nesting would require recursive export.
- **Fonts in typewriter**: True character-by-character typewriter would require font rendering on canvas. Current "Text Reveal" does a clean left-to-right clip instead.
- **Video seeking precision**: Background video frame accuracy depends on browser's video decoder. For frame-perfect sync, pre-render the bg video to image sequence.
- **Large frames**: Very large frames (4K+) with many elements may be slow to export due to canvas compositing.

## Converting WebM → MP4 (if needed)

If the export produces WebM and you need MP4 for social platforms:

```bash
ffmpeg -i video.webm -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k output.mp4
```
