# Frame to Video — Figma Plugin

Turn a Figma **Section** (or a single Frame) into animated videos — one per frame variant — with combinable element animations, per-line text animation, background video and audio, per-instance video replacement, Key Art video slots, in-plugin MOV/ProRes conversion via ffmpeg.wasm, per-zone transparency control, and an alpha-export path for After Effects compositing (ProRes 4444 MOV or PNG sequence ZIP).

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
- **Transparent toggle**: each video drop-zone has a `Transparent` checkbox that picks the conversion path — on = VP9 WebM with alpha + bitmap frame cache; off = H.264 MP4 (hardware-decoded). Defaults: BG Video + Key Art slots off, Element Video on.
- **Alpha export**: a pipeline mode (checkbox in the Export section) that produces a transparent-background ProRes 4444 MOV or PNG sequence ZIP for AE roundtripping, skipping bg fill + bg video.

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

- **Supported formats:** anything ffmpeg.wasm can read. The plugin always re-encodes dropped videos to a browser-friendly codec (H.264 MP4 or VP9 alpha WebM — see *Video conversion pipeline* below). MOV / ProRes / ProRes 4444 / AVI / MP4 / WebM all work.
- The drop-zone has **Loop** and **Transparent** checkboxes:
  - `Loop` — cycle the video if the element's on-screen time exceeds the clip duration.
  - `Transparent` — preserve alpha. Defaults to **on** for per-instance videos (logos / badges usually composite with transparency). Turn off for a full-rect element replacement to get hardware-decoded H.264 MP4.
- Because element videos are keyed by normalized layer name, dropping a video on "Logo A" in variant 1 replaces "Logo A" in every variant that has a same-named layer.

Per-instance videos auto-play in the preview and are recorded in the export.

### 5. Key Art slots (by name, shared across variants)

Any Figma layer whose name normalizes to `keyart1`, `keyart2`, etc. (so `KeyArt 1`, `KEYART1`, `key art 2` all match) becomes a slot in the **Key Art Videos** section of the right panel. Drop one video per slot and every variant that contains that slot renders the video at the rect the static Key Art occupies in that variant.

Each slot has **Loop**, **Transparent**, and **Opacity** controls:
- `Transparent` **defaults off** for Key Art slots because the typical drop here is a full-canvas hero video, which should use H.264 MP4 for hardware-decoded smooth playback at native resolution. Turn on only if the key art really needs to composite with transparency.
- Flipping `Transparent` after a video is loaded prints a log message asking you to re-drop; we don't auto re-convert because that'd kick off another 2–5 s ffmpeg pass without your go-ahead.

Use Key Art slots when you want one video to serve a group of variants (square hero, portrait hero, landscape hero) via the same-named layer in each. Use per-instance replacement when you want to swap one specific element.

### 6. Background video and audio

- **Background Video**: plays behind all elements in every variant (cover-fit). Supports `Loop`, `Opacity`, and `Transparent` toggle. Transparent defaults off (backgrounds almost never need alpha, and H.264 MP4 plays smooth via hardware decode).
- **Background Audio**: muxed into every exported file with volume control.

Both route through the ffmpeg.wasm converter — drop a MOV, MP4, or WebM, get a normalized H.264 MP4 (or VP9 WebM if Transparent is on) back.

### 7. Standard export (MP4 / WebM)

Right panel → **Export** section:

- **Format**: MP4 (H.264) when the Chromium build supports it, else WebM.
- **Quality target**: toggle between
  - **Bitrate (Mbps)** — direct bitrate control (default **25 Mbps**), or
  - **Target file size (MB)** — plugin derives the bitrate from `(MB × 8) / duration × 0.95` (5 % headroom buffer).
- **Duration** / **Frame rate** / **Resolution** live in the **Video Settings** section above.

Click **Export Video**. Each variant is rendered and downloaded sequentially, with its filename taken from the editable field in the Variants column (default `<SectionName>_<FrameName>`, sanitized).

During export: all videos play forward at real-time 1× speed, the render loop paces precisely at `1000/fps` ms per frame, and MediaRecorder captures the offscreen canvas continuously. A 6 s export takes ~6 s of wall time and produces a 6 s file.

**First-frame anti-flash.** Before MediaRecorder starts, every `<video>`-backed source is routed through `primeVideo(v, t)` — a helper that writes `currentTime`, awaits the real `seeked` event, calls `.play()`, and waits for the first post-play frame via `requestVideoFrameCallback` (with a `playing`-event + 300 ms fallback and a 1.5 s hard cap). Without this, the decoder can still be seeking when `drawImage(video, …)` runs and the first captured frame falls back to the static PNG. `primeVideo` is skipped for bitmap-backed entries — they have no decoder to prime.

### 8. Alpha export (for After Effects)

Tick **Alpha export (for After Effects)** in the Export section and the pipeline switches from MediaRecorder to a frame-capture path that produces a transparent-background file you can composite over anything in AE:

1. Each frame is composed onto an alpha-enabled canvas with **no background fill and no BG video** — only your animated elements.
2. Captured as lossless PNG via `canvas.toBlob("image/png")`.
3. The plugin feeds the PNG sequence to ffmpeg.wasm and tries to produce a single **ProRes 4444 MOV** (`-c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le -qscale:v 10`). AE imports this natively — one file, 10-bit color + alpha, effectively lossless.
4. If `prores_ks` isn't present in the WASM core build, the plugin falls back to a **PNG sequence ZIP** containing `frame_0001.png`, `frame_0002.png`, … . Drop the extracted folder into AE as an Image Sequence. Alpha preserved.

The ZIP is built by an inline ~90-line ZIP writer (CRC-32 table + local-file-header / central-dir / EOCD, STORE method since PNGs are already compressed) so no extra CDN dependency is pulled. Typical 6 s at 1080p: ProRes 4444 ~100 MB, PNG ZIP ~50–150 MB depending on content complexity.

Bitmap-backed key art / element videos still draw from their cached `ImageBitmap` array during alpha export — the composition is as smooth as the standard export, just with transparency preserved and a different output format.

---

## Settings persistence

On any change, the plugin saves to browser `localStorage` (scoped to the plugin iframe):

- All export / video settings (duration, fps, resolution, bitrate, quality mode, target MB, opacity, audio volume, bg-video loop flag)
- The preview loop toggle
- Every animation preset (keyed by normalized name / line index)

Closing Figma and reopening the plugin restores every setting and every preset. Media files (bg video, audio, Key Art videos, element videos) are not persisted because browser sandboxes can't reconstruct `File` objects from disk paths — reload those each session.

To wipe all saved presets and settings: open the plugin's debug panel, run `localStorage.clear()` from your browser dev tools (Figma desktop → View → Debug), or reload the plugin with an incognito profile.

---

## Video conversion pipeline

Every video drop is normalized through `ffmpeg.wasm` (lazily loaded from `unpkg.com` on the first drop — ~30 MB one-time, cached afterwards). Each drop-zone has a **Transparent** checkbox that picks the output codec and the downstream playback strategy:

### Non-alpha path — H.264 MP4 (hardware-decoded)

Used when **Transparent is off** — the default for BG Video and Key Art slots. Chromium hardware-decodes H.264 on every platform (VideoToolbox on macOS, DXVA on Windows, VA-API on Linux), so `<video>` playback is smooth at 1080p with zero memory cost.

```
ffmpeg -i input.<ext> \
  -c:v libx264 \
  -preset veryfast -crf 20 \
  -pix_fmt yuv420p \
  -vf "scale='min(1080,iw)':-2:flags=lanczos" \
  -r <fps> -g <fps*2> \
  -movflags +faststart -an \
  output.mp4
```

`-crf 20` is visually lossless for most content. `veryfast` keeps encode time short. `+faststart` puts the moov atom first so `<video>` can start playing before the full file downloads.

### Alpha path — VP9 WebM + ImageBitmap frame cache

Used when **Transparent is on** — the default for Element Videos. Chromium *software*-decodes VP9 with `yuva420p` because no hardware decoder outputs alpha, so decoder stalls are a real risk whenever `drawImage(video, …)` competes with the compositor for CPU. The plugin mitigates this by pre-decoding frames once into an `ImageBitmap` array at drop time and drawing from that array at preview / export time — pure GPU blits, no decoder in the hot path.

Two ffmpeg passes run back-to-back:

1. **Encode pass** — produces the playable WebM, tuned for smooth `<video>` fallback (bitmaps-over-budget) playback:

   ```
   ffmpeg -i input.<ext> \
     -c:v libvpx-vp9 -pix_fmt yuva420p \
     -vf "scale='min(1080,iw)':-2:flags=lanczos" \
     -r <fps> -b:v 4M \
     -deadline good -cpu-used 4 \
     -row-mt 1 -tile-columns 2 \
     -g <fps> -keyint_min <fps> \
     -auto-alt-ref 0 \
     output.webm
   ```

   `-g <fps>` (one keyframe every second) keeps decoder stalls recoverable in ≤1 s. `-row-mt 1 -tile-columns 2` enables parallel-decode hints on the *playback* side even though the WASM encoder runs single-threaded. `-auto-alt-ref 0` is mandatory for `yuva420p` alpha output.

2. **Frame-extract pass** — emits one PNG per frame at the rendered element size, decoded to `ImageBitmap` via `createImageBitmap`:

   ```
   ffmpeg -i output.webm \
     -vf "fps=<fps>,scale=<w>:<h>:flags=lanczos" \
     -pix_fmt rgba \
     frame_%04d.png
   ```

   `<w> × <h>` is computed by `largestRectForElements` — it walks every variant and picks a bitmap size big enough for every same-named (or same-slot) element in the set, so drawing into a smaller element's rect downscales for free instead of upscaling and losing quality.

**Memory budget.** Total bitmap memory is estimated as `w × h × 4 × frame_count`. If that exceeds 200 MB, the frame-extract pass is skipped and the loader logs a warning. Playback falls through to `<video>` (still works, but the software VP9-alpha decoder can stutter). For a full-canvas 1080×1920 key art the bitmap array alone would be ~1.1 GB, so this case always ends up on the `<video>` path — which is why the recommended workflow for full-canvas key art is **Transparent off** (H.264 MP4, no cache, hardware-decoded). The bitmap path is intended for small-to-medium elements (logos, badges).

### Progress feedback

Conversions show a live progress parser in a toast: `Downloading converter script… 100%` → `Downloading core JS… 100%` → `Downloading WASM… 45%` on first use; then `Converting to H.264 MP4… NN%` or `Converting to VP9 alpha WebM… NN%` → `Extracting frames… NN%` → `Decoding bitmaps…` → `Converted ✓ · N frames cached · alpha`.

### Loader details

`ffmpeg.wasm` is loaded by pre-fetching the core JS + WASM on the main thread with `Response.body.getReader()` streaming, then passing same-origin `blob:` URLs to `ff.load()`. This sidesteps a Figma plugin-iframe quirk where the worker that `@ffmpeg/ffmpeg` spawns internally can't always cross-origin fetch from `unpkg.com` and hangs silently. A 60 s timeout on `ff.load()` catches deeper sandbox issues and falls back to showing the CLI command in a toast.

### CLI fallback

If the loader fails (network blocked, CDN unavailable, plugin CSP rejects the script load), the plugin shows the equivalent `ffmpeg` command in a toast so you can run it locally and drop the resulting file back in.

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

### Architecture

- `code.js` — Figma main thread. Validates the selection, walks frame children, exports each as a 2× PNG with absolute render bounds, detects multi-line text via `/\r\n|\r|\n| | /`, posts messages to the UI.
- `ui.html` — single-file UI (HTML + CSS + JS). Preview compositing on an HTML5 canvas; standard export via an offscreen canvas + `captureStream(fps)` + `MediaRecorder`; alpha export via per-frame `canvas.toBlob("image/png")` + ffmpeg.wasm `prores_ks` (or inline ZIP writer fallback).
- `manifest.json` — plugin manifest (API 1.0.0), network allowlist (`gist.githubusercontent.com`, `raw.githubusercontent.com`, `unpkg.com`).

### Render pipeline

Single source of truth: `composeFrame(c, frame, w, h, t)` paints the background colour, the bg video (cover-fit with opacity), then every element via `drawElement(c, el, t)`. Called by both preview and export — structurally impossible to diverge. Alpha export uses `composeAlphaFrame` which skips the bg fill + bg video but otherwise walks the same element loop.

Per-element draw order in `drawSingle`:
1. `state.elementVideos[el.normalizedName]` — per-instance replacement (shared across variants by name).
2. `state.keyArtVideos[el.keyArtSlot]` — same video across every element wired to the slot.
3. Static PNG fallback.

Video entries route through `drawEntryCover(c, entry, …, t)` which prefers `entry.frames[Math.floor(t × entry.fps) % entry.frames.length]` when pre-decoded bitmaps exist, else `drawImage(entry.video, …)`. No `readyState` gate — entries are only populated inside each loader's `loadeddata` handler, so `drawImage` always has a cached frame even during a mid-seek decoder transition.

Multi-line text is drawn as N horizontal band slices of the same PNG (`ctx.drawImage` 9-arg form) at `y + i × bandHeight`, each band independently animated via its `<layer>__lineN` preset.

### Preview playback

`startPlayback` is async: it collects every `<video>`-backed entry (skipping bitmap-backed ones — they have no decoder to prime), runs `primeVideo(v, targetTime)` on each in parallel, then anchors the wall clock and kicks off the `playLoop()` rAF loop. This adds ~50–200 ms of latency to hitting Play but guarantees the first rendered frame has real video pixels (no static-PNG flash).

`primeVideo` writes `currentTime`, awaits `seeked`, calls `.play()`, and awaits `requestVideoFrameCallback` (with `playing` + 300 ms fallback and a 1.5 s hard cap so a wedged decoder can't hang the pipeline).

### Standard export (MediaRecorder)

- `offCanvas = <canvas>` sized to chosen output resolution.
- `stream = offCanvas.captureStream(fps)` — browser samples on wall-clock.
- All `<video>`-backed entries are primed via `primeVideo(v, 0)` **before** `recorder.start()`. Bitmap-backed entries are skipped.
- Offscreen canvas is painted with frame 0 **before** `recorder.start()` so the sampler's first capture already has real pixels.
- Render loop paces to exactly `1000 / fps` ms per frame via `performance.now()` — wall time equals nominal duration.
- `MediaRecorder` writes chunks; on stop, they're blob-joined and triggered as a download with the per-variant filename.

### Alpha export (ProRes 4444 MOV / PNG sequence ZIP)

- Offscreen canvas is created with `getContext("2d", { alpha: true })`.
- Per frame: `clearRect` → `composeAlphaFrame` (skips bg fill + bg video) → `canvas.toBlob("image/png")` → accumulate in `pngs[]`.
- Try `ffmpeg.wasm` with `-c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le -qscale:v 10 -vendor apl0` to produce a single `.mov`. On encoder-unavailable error, fall back to the inline `buildZip(pngs)` helper → download `<name>_frames.zip`.
- Progress bar shows two-stage: capture (0–50 %) → encode (50–100 %) for MOV, or 0–50 % → ZIP-build for the fallback path.

### Conversion pipeline (`convertVideo`)

- Input normalization via ffmpeg.wasm. Always runs — no `looksLikeMov` gate. Any video drop (mov / mp4 / webm / avi) re-encodes to the codec matching the zone's Transparent preference.
- Lazy loader (`loadFFmpeg`) pre-fetches `@ffmpeg/ffmpeg` UMD + `@ffmpeg/core` JS + WASM via `fetch().getReader()` streaming with visible progress, then passes same-origin `blob:` URLs to `ff.load()`. 60 s timeout on `ff.load()`.
- Alpha=false → H.264 MP4 (`libx264 -preset veryfast -crf 20 -pix_fmt yuv420p -movflags +faststart`).
- Alpha=true → VP9 WebM (`libvpx-vp9 -pix_fmt yuva420p -g fps -keyint_min fps -row-mt 1 -tile-columns 2 -auto-alt-ref 0`) + frame-extract pass → `createImageBitmap` per PNG.
- `largestRectForElements(predicate)` picks a single bitmap size big enough for every matching element across every variant.
- Bitmap memory budget: 200 MB. Over-budget elements skip frame pre-decode and fall back to `<video>`.
- `releaseEntryFrames(entry)` calls `bitmap.close()` on each frame before overwrite / removal to reclaim GPU memory.

### Animation engine

- Preset shape: `{ effects: {fade, slide, scale, textReveal}, start, duration, easing, distance }`.
- `computeAnimTransform(a, t)` returns `{opacity, offsetX, offsetY, scaleVal, clipFrac}` — effects compose additively (slide offsets, opacity) / multiplicatively (scale).
- Easings: `easeOut` (cubic), `easeIn`, `easeInOut`, `linear`.
- Presets keyed by normalized layer name (`<layer>` for whole element, `<layer>__lineN` for per-line).

### Persistence

`localStorage` keys:
- `f2v.animPresets.v2` — every animation preset (object, keyed by normalized name or `<name>__lineN`).
- `f2v.settings.v1` — duration, fps, resolution, bitrate, quality mode, target MB size, bg-video opacity, audio volume, bg-video loop, bg-video Transparent, element-video Transparent, alpha-export toggle, preview-loop toggle.

Media files (bg video, audio, Key Art videos, element videos) are not persisted because browser sandboxes can't reconstruct `File` objects from disk paths — re-drop each session.

### Input video support

Anything ffmpeg.wasm can read. Verified: MOV (incl. ProRes / ProRes 4444), MP4 (H.264 / H.265), WebM (VP8 / VP9), AVI. All are re-encoded to the zone's target codec on drop. If your video has alpha (ProRes 4444, VP9 yuva420p), keep the zone's Transparent toggle on to preserve it through the pipeline.

---

## Limitations

- **Nested frames**: the plugin walks direct children only. Deep hierarchies would require a recursive exporter.
- **Auto-wrapped text**: can't be split per-line (Figma read API doesn't expose wrap points). Use explicit Enters.
- **Mixed per-range styles across lines**: a multi-line text with line 1 at 48 px and line 2 at 24 px splits into equal-height bands (`renderH / lineCount`), so the bands will visually misalign.
- **Large frames**: 4K+ frames with many elements may be slow to render per frame — export time = duration, and if the render can't finish within `1000/fps` ms the recorder samples duplicate frames (manifests as visible stutter).
- **Full-canvas alpha videos**: the bitmap frame cache has a 200 MB budget, which 1080×1920 × 144 frames (~1.1 GB) exceeds. Over-budget alpha videos fall back to `<video>` playback with software VP9 decode, which can stutter. Workaround: turn `Transparent` **off** and use H.264 MP4 for full-canvas key art, or pre-composite the alpha in AE after an alpha-export pass.
- **FPS change after drop**: bitmap pre-decode sample rate is set at convert time. If you change the export fps after dropping an alpha video, re-drop to resample. Animations (which are `t`-driven) adapt to the new fps automatically.
- **Media files aren't persisted**: localStorage can't hold `File` objects, so bg video / audio / key art videos / element videos need to be re-dropped each plugin session.
- **ProRes encoder availability**: alpha export tries `prores_ks` first but falls back to a PNG sequence ZIP if the encoder isn't compiled into the `@ffmpeg/core` build at the pinned version. Both are AE-compatible — the ZIP just needs "Import as Image Sequence".

---

## Workflow conventions (for contributors)

- Branch: `claude/<thing>`. Development happens on the branch, not `main`.
- After any batch of commits, open a PR to `main` and merge it (see `CLAUDE.md` for the full auto-merge workflow).
- Enable **Repo Settings → General → Pull Requests → "Automatically delete head branches"** so merged feature branches are cleaned up server-side.
