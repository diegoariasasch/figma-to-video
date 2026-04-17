# Frame to Video — Figma Plugin

Turn a Figma **Section** (or a single Frame) into animated videos — one per frame variant — with combinable element animations, per-line text animation, background video and audio, per-instance video replacement, Key Art video slots, and per-variant filename control.

---

## Installation

1. Clone this repo.
2. In Figma desktop: **Plugins → Development → Import plugin from manifest…**
3. Select `manifest.json`.
4. The plugin appears under **Plugins → Development → Frame to Video**.

The plugin window is 1200 × 720 and uses a 5-column layout (Variants · Elements · Animation · Canvas · Settings).

---

## Concepts

- **Variant**: one child frame of a Section. A Section containing three frames (say a square, a landscape, and a portrait) becomes a **set** of three variants that share animation settings and media.
- **Element**: one direct child of a variant frame, exported as a high-res (2×) PNG and composited on an HTML5 canvas.
- **Animation preset**: a per-element (or per-line) animation config. Presets are keyed by the layer's normalized name (lowercase, spaces stripped) so they're shared across variants and across plugin reopens.
- **Key Art slot**: a layer named `KeyArt N` (case- and space-insensitive) that becomes a video-replaceable slot across every variant.
- **Element video**: a per-instance video replacement on a specific element you click on. Independent of Key Art naming.

---

## How to use

### 1. Load a selection

Select **one** of:
- a **Section** containing child frames → loaded as a multi-variant set, or
- a single **Frame / Component / Instance / Group** → loaded as a 1-variant set.

Click **Load Selection**. Each variant's direct children are exported as PNGs at 2× scale. The debug panel logs each ingested element and reports which text layers split into multiple lines.

### 2. Animate elements

Click an element in the **Elements** column. The **Animation** column shows:

- **Effects** (all combinable — check any combination):
  - `Fade In` — opacity 0 → 1
  - `Scale In` — 30% → 100%
  - `Text Reveal (L→R)` — progressive left-to-right clip
  - `Slide from` dropdown — `Left` / `Right` / `Top` / `Bottom` (unset = no slide)
- **Start (s)** — when the animation begins in the video's timeline
- **Duration (s)** — how long the animation runs
- **Easing** — Ease Out / Ease In-Out / Ease In / Linear
- **Distance (px)** — offset for Slide effects (100 = slides 100px into place)

Click **Apply to Element** to commit the preset. The row in the Elements list gets a badge summarising active effects (e.g. `fade+slide up`).

**Combining effects example:** check `Fade In`, set `Slide from: Bottom`, Duration 0.4s, Easing Ease Out → the element fades AND slides up into place simultaneously.

**Apply to All** applies the current effect config to every element across every variant, auto-staggering start times by 0.15 s.
**Clear** removes the preset for the currently selected element (or line).

### 3. Per-line text animation

If a text layer in Figma contains explicit line breaks (you pressed **Enter** between lines), the plugin detects this and shows the layer as:

```
Text (3 lines)
  Line 1: Hello
  Line 2: World
  Line 3: There
```

Each `Line N` row gets its own animation preset, keyed by `<layer>__lineN`. Click a line, apply an animation, repeat for the other lines with staggered starts to sequence the reveal.

Line detection handles `\n`, `\r\n`, `\r`, `\u2028`, and `\u2029` separators. **Auto-wrapped text** (no explicit newline — breaks only because the box is narrow) stays as a single element; Figma's read API doesn't expose wrap positions. To animate wrapped copy line-by-line, add Enters in Figma. The debug panel logs the detection state for every text layer.

### 4. Per-instance video replacement

In the Animation column, below the effect controls, a **Replace with video** drop-zone swaps the static PNG for that specific element with a video — keeping the element's exact position, size, and any animations. Perfect for animated logos or motion badges.

- Supported: WebM (VP9 / VP8, with alpha if encoded that way), MP4 (H.264), AV1.
- **Not supported:** MOV / ProRes / ProRes 4444. The plugin detects `.mov` drops and displays a ready-to-paste `ffmpeg` conversion command (see *Alpha channel workflow* below).
- Tick **Loop** to cycle the video if the element's on-screen time exceeds the video's duration.

Per-instance videos auto-play in the preview and are recorded in the export.

### 5. Key Art slots (by name, shared across variants)

Any Figma layer whose name normalizes to `keyart1`, `keyart2`, etc. (so `KeyArt 1`, `KEYART1`, `key art 2` all match) becomes a slot in the **Key Art Videos** section of the right panel. Drop one video per slot and every variant that contains that slot renders the video at the rect the static Key Art occupies in that variant.

Use Key Art slots when you want one video to serve a group of variants (square hero, portrait hero, landscape hero) via the same-named layer in each. Use per-instance replacement when you want to swap one specific element.

### 6. Background video and audio

- **Background Video**: plays behind all elements in every variant (cover-fit). Supports opacity and loop toggle.
- **Background Audio**: muxed into every exported file with volume control.

Both use the same MOV detection as other video drops.

### 7. Export

Right panel → **Export** section:

- **Format**: MP4 (H.264) when the Chromium build supports it, else WebM.
- **Quality target**: toggle between
  - **Bitrate (Mbps)** — direct bitrate control (default **25 Mbps**), or
  - **Target file size (MB)** — plugin derives the bitrate from `(MB × 8) / duration × 0.95` (5 % headroom buffer).
- **Duration** / **Frame rate** / **Resolution** live in the **Video Settings** section above.

Click **Export Video**. Each variant is rendered and downloaded sequentially, with its filename taken from the editable field in the Variants column (default `<SectionName>_<FrameName>`, sanitized).

During export: all videos play forward at real-time 1× speed, the render loop paces precisely at `1000/fps` ms per frame, and MediaRecorder captures the offscreen canvas continuously. A 6 s export takes ~6 s of wall time and produces a 6 s file.

---

## Settings persistence

On any change, the plugin saves to browser `localStorage` (scoped to the plugin iframe):

- All export / video settings (duration, fps, resolution, bitrate, quality mode, target MB, opacity, audio volume, bg-video loop flag)
- The preview loop toggle
- Every animation preset (keyed by normalized name / line index)

Closing Figma and reopening the plugin restores every setting and every preset. Media files (bg video, audio, Key Art videos, element videos) are not persisted because browser sandboxes can't reconstruct `File` objects from disk paths — reload those each session.

To wipe all saved presets and settings: open the plugin's debug panel, run `localStorage.clear()` from your browser dev tools (Figma desktop → View → Debug), or reload the plugin with an incognito profile.

---

## Alpha channel workflow

Chromium (and therefore Figma desktop) can decode **WebM with VP9 alpha** (`yuva420p`). It cannot decode ProRes / ProRes 4444 MOV directly.

**In-plugin conversion (recommended).** When you drop a `.mov` / `.qt` into any video field, the plugin lazily loads `ffmpeg.wasm` from `unpkg.com` (first drop only: one-time ~30 MB download; cached afterwards) and transcodes to WebM + VP9 + alpha in the browser. Status is shown in a toast (`Loading converter…` → `Converting…` → `Converted ✓`), then the resulting WebM is loaded automatically. Conversion runs roughly 1–3× real time depending on clip length and resolution.

Under the hood the plugin runs:

```
ffmpeg -i input.mov -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 4M -auto-alt-ref 0 output.webm
```

**CLI fallback.** If the loader can't fetch `ffmpeg.wasm` (network blocked, CDN unavailable, plugin sandbox CSP), the plugin shows the exact command above in a toast so you can run it locally and drop the resulting `.webm` back in.

Either way: the exported file is WebM (or MP4 where supported); WebM + VP9 alpha is the end-to-end alpha-capable format, so transparency flows through from your source logo to the final render.

---

## Remote kill switch

The plugin supports an optional remote kill switch so you can disable every installed instance at once.

1. Create a GitHub gist or repo file named `status.json` with content `{"disabled": false}`.
2. Copy the **raw** URL (host must be `gist.githubusercontent.com` or `raw.githubusercontent.com` — both are allowlisted in `manifest.json`).
3. Set `KILL_SWITCH_URL` at the top of `ui.html` to that URL.
4. Reinstall the plugin (or ask users to re-import the manifest).

To kill: edit the JSON to `{"disabled": true, "message": "Plugin disabled — contact admin."}`. On next plugin open, the UI is replaced with a disabled screen.

Behavior:
- **Fail-open:** if the fetch fails (offline, blocked, malformed JSON), the plugin runs normally.
- **Fresh check on every plugin open** (`cache: "no-store"`), so the kill takes effect as soon as Figma re-opens the plugin.
- **No telemetry**: the fetch sends no user data; it's a GET for a single JSON file.

The plugin only talks to allowlisted domains (`gist.githubusercontent.com`, `raw.githubusercontent.com`, `unpkg.com`). Edit `manifest.json`'s `networkAccess.allowedDomains` to host the kill-switch file or the ffmpeg.wasm bundle elsewhere.

---

## Technical specs

- **Architecture**
  - `code.js` — Figma main thread. Validates the selection, walks frame children, exports each as a 2× PNG with absolute render bounds, posts messages to the UI.
  - `ui.html` — single-file UI (HTML + CSS + JS). Compositing is done on an HTML5 canvas; export uses an offscreen canvas + `MediaStreamTrack` + `MediaRecorder`.
  - `manifest.json` — plugin manifest (API 1.0.0), network allowlist for kill switch.
- **Render pipeline**
  - Single source of truth: `composeFrame(c, frame, w, h, t)` paints the background colour, the bg video (cover-fit with opacity), then every element via `drawElement(c, el, t)`. Called by both preview and export — structurally impossible to diverge.
  - Per-element draw first checks `state.elementVideos[el.id]` (per-instance replacement), then `state.keyArtVideos[el.keyArtSlot]`, then falls back to the static PNG.
  - Multi-line text is drawn as N horizontal band slices of the same PNG (`ctx.drawImage` 9-arg form) at `y + i × bandHeight`.
- **Export**
  - `offCanvas = <canvas>` sized to chosen output resolution.
  - `stream = offCanvas.captureStream(fps)` — browser samples on wall-clock.
  - All videos are `.play()`-ed at export start so they advance at 1×. No per-frame seeks.
  - Render loop paces to exactly `1000 / fps` ms per frame via `performance.now()` — wall time equals nominal duration.
  - `MediaRecorder` writes chunks; on stop, they're blob-joined and triggered as a download with the per-variant filename.
- **Animation engine**
  - Preset shape: `{ effects: {fade, slide, scale, textReveal}, start, duration, easing, distance }`.
  - `computeAnimTransform(a, t)` returns `{opacity, offsetX, offsetY, scaleVal, clipFrac}` — effects compose additively/multiplicatively.
  - Easings: `easeOut` (cubic), `easeIn`, `easeInOut`, `linear`.
- **Persistence** — `localStorage` keys `f2v.animPresets.v2` and `f2v.settings.v1`.
- **Supported video codecs** — whatever Chromium's `<video>` supports. In practice: VP8, VP9 (with alpha), AV1, H.264. ProRes/MOV: **not** decodable — transcode to VP9 alpha.

---

## Limitations

- **Nested frames**: the plugin walks direct children only. Deep hierarchies would require a recursive exporter.
- **Auto-wrapped text**: can't be split per-line (Figma read API doesn't expose wrap points). Use explicit Enters.
- **Mixed per-range styles across lines**: a multi-line text with line 1 at 48 px and line 2 at 24 px splits into equal-height bands (`renderH / lineCount`), so the bands will visually misalign.
- **Large frames**: 4K+ frames with many elements may be slow to render per frame — export time = duration, and if the render can't finish within `1000/fps` ms the recorder samples duplicate frames (manifests as visible stutter).
- **ProRes MOV**: not decodable. Transcode to WebM VP9 alpha.

---

## Workflow conventions (for contributors)

- Branch: `claude/<thing>`. Development happens on the branch, not `main`.
- After any batch of commits, open a PR to `main` and merge it (see `CLAUDE.md` for the full auto-merge workflow).
- Enable **Repo Settings → General → Pull Requests → "Automatically delete head branches"** so merged feature branches are cleaned up server-side.
