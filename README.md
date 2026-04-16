# Frame to Video — Figma Plugin

Export Figma frames as animated 1080p videos with background video, music, and element animations. Supports **frame sets** (Sections with many variants) and **Key Art video replacement** for a consistent look across differently-sized frames.

## Installation

1. In Figma, go to **Plugins → Development → Import plugin from manifest…**
2. Select the `manifest.json` from this folder
3. The plugin appears under Plugins → Development → Frame to Video

## How to Use

### 1. Load a Selection
You can select either:
- **A single Frame** (Component/Instance/Group also work) — loaded as a 1-variant set, or
- **A Section** containing multiple sibling frames — every child frame is loaded as a **variant** of the same set

Click **"Load Selection"**. The plugin exports each variant's direct children as high-res PNGs.

Each variant appears in the **Variants** list (left panel) with its dimensions and an editable filename. Click a variant to preview it.

### 2. Key Art Video Replacement
Any layer whose name matches `KeyArt N` (case- and space-insensitive — `KeyArt 1`, `keyart1`, `KEY ART 1`, `KEYART1` all work) is detected as a **Key Art slot**. These appear in the **Key Art Videos** panel on the right.

- Drop a video into a slot → it replaces the static Key Art image in every variant that contains that slot, **at the exact position and size the static Key Art occupies in each variant**.
- This means scale/position auto-match across frame sizes. Author your video at the reference aspect ratio; if the variant rect differs slightly, the video is center-cropped (cover-fit).
- Each slot has its own loop and opacity controls.

### 3. Configure Animations
Click any element in the Elements list. Choose an animation type:
- **Fade In** — opacity 0→1
- **Slide from Left/Right/Top/Bottom** — slide in with fade
- **Scale In** — scales from 30% to 100% with fade
- **Text Reveal →** — progressive left-to-right clip reveal

Set **Start**, **Duration**, **Distance**, and **Easing**. Click **"Apply to Element"** or **"Apply to All"**.

Animations are **shared across the set** by element name — applying Fade In to `Headline` in one variant applies it to every variant's `Headline`. (Matching is case- and space-insensitive, same rules as Key Art.)

**Per-line animation:** Text layers with explicit line breaks (you pressed Enter between lines in Figma) automatically split into `Line 1 … Line N` rows in the Elements list — each independently animatable, each keyed by `<name>__lineN` so presets are still shared across variants. Auto-wrapped text (a single run that wraps because the box is narrow) stays as one element since Figma's read API doesn't expose wrap positions. To animate wrapped copy line-by-line, add explicit newlines in Figma. The debug panel logs a hint ("press Enter between lines…") for every text layer it couldn't split.

### 4. Add Background Media (Set-Wide)
- **Background Video**: plays behind all elements in every variant (cover-fit), adjustable opacity
- **Background Audio**: muxed into every export with volume control

### 5. Preview
- Use ▶ / ⏸ to play/pause
- Click the timeline to scrub
- Adjust **Duration** in the right panel for total video length
- Switch variants in the left panel to preview each one

### 6. Export
- Set resolution (1080p default), frame rate (30fps default), and quality
- Each variant has an **editable filename** defaulting to `<SectionName>_<FrameName>` (sanitized)
- Click **"Export Video"** — the plugin renders every variant sequentially and triggers a download for each
- MP4 auto-detected on recent Chrome/Figma desktop; otherwise WebM

## Architecture

```
manifest.json     → Plugin config
code.js           → Figma main thread: reads Section or Frame,
                    iterates frame children, exports each as a high-res PNG
ui.html           → Plugin UI (all-in-one):
                      ├── State: frames[] (variants), animPresets, keyArtVideos (per-slot)
                      ├── Key Art detection (name → "keyartN" slot)
                      ├── Animation engine (shared across set by element name)
                      ├── Canvas renderer (bg video + per-element static/video draw)
                      ├── Playback controller (real-time preview of current variant)
                      ├── Media loader (bg + per-slot videos via Blob URLs)
                      └── Export engine (iterates variants → MediaRecorder per variant)
```

## Technical Notes

- **Elements are exported at 2x scale** from Figma for crisp rendering, drawn at 1x size on canvas
- **Export uses MediaRecorder API** — no external dependencies, runs entirely in-browser
- **Audio muxing** uses AudioContext → MediaStreamDestination to combine audio + video streams
- **Frame-accurate rendering**: Export loop renders each frame sequentially with `setTimeout` yields
- **MP4 support**: Auto-detected via `MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')` — available on recent Chromium builds (Figma desktop). Falls back to VP9 WebM.
- **No external dependencies** — everything is vanilla JS, no npm/build step required

## Limitations & Future Improvements

- **Nested frames**: Currently only reads direct children of each variant frame. Deep nesting would require recursive export.
- **Fonts in typewriter**: True character-by-character typewriter would require font rendering on canvas. Current "Text Reveal" does a clean left-to-right clip instead.
- **Video seeking precision**: Background + Key Art video frame accuracy depends on browser's video decoder. For frame-perfect sync, pre-render the source video to an image sequence.
- **Large frames**: Very large frames (4K+) with many elements may be slow to export due to canvas compositing.
- **Key Art aspect mismatch**: If the Key Art video's aspect differs from a variant's Key Art rect, the video is center-cropped (cover-fit). For best results, author one video per dominant aspect and author multiple Key Arts (`KeyArt 1` for landscape, `KeyArt 2` for portrait, etc.).

## Converting WebM → MP4 (if needed)

If the export produces WebM and you need MP4 for social platforms:

```bash
ffmpeg -i video.webm -c:v libx264 -crf 18 -preset slow -c:a aac -b:a 192k output.mp4
```
