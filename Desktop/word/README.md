# WordPad Pro

Desktop Microsoft Word clone built with **Electron + React + TypeScript + Tiptap + Vite + Tailwind CSS**. Runs on Windows and macOS from one codebase.

## Run

```powershell
npm install
npm run dev      # dev with hot reload
npm run build    # production bundles (out/)
npm run build:win  # Windows .exe (NSIS installer)
npm run build:mac  # macOS .dmg
npm test         # Vitest suite
```

## Images (`src/renderer/features/images/`)

Complete Word-style picture pipeline:

- **Insert** — file picker, drag & drop, clipboard paste, image URL, screenshot capture (`desktopCapturer`), webcam photo, screen clipping (screenshot + crop), AI generation, stock photos, built-in icons.
- **In-document handling** — custom `atlasImage` Tiptap node with 8 drag handles (corners keep aspect ratio, `Shift` unlocks), exact size in px/cm/%, 90° rotation, flip H/V, aspect lock.
- **Crop** — overlay tool with draggable box, rule-of-thirds grid, presets (free, 1:1, 4:3, 16:9, circle mask).
- **Wrapping & layout** — inline, square, tight, behind text, in-front-of-text; free positioning with snap-to-guides; alignment; layer order; group/ungroup into grid containers.
- **Format panel** — border (colour/width/style), shadow, rounded corners, reflection, 8-style gallery, caption, alt text, replace, reset-to-original, JPEG compress.
- **Built-in editor** (double-click) — canvas pipeline: brightness, contrast, saturation, exposure, sharpness, blur, temperature, tint, hue; 6 filter presets with live preview + before/after slider; pen, highlighter, arrow, rectangle, circle, text, blur/pixelate redact; undo/redo; Apply/Cancel; non-destructive (master + edit recipe stored on the node).
- **Smart tools** — offline background removal (`@imgly/background-removal`, model downloads once then runs offline), OCR English + Tamil (`tesseract.js`), AI alt text + image generation over any OpenAI-compatible endpoint (key in OS keychain via `safeStorage`), Unsplash/Pexels search (own keys), emoji + icon picker.
- **Extras** — collage layouts (2×2, 3×1, stacked…), right-click picture menu (native, with spelling menu preserved for text), export PNG/JPG/WebP at 10–100% scale, "Save as Picture".
- **Portability** — `.docx` export embeds media with size, baked crop, wrap/position, flip and border; layout round-trips through alt text on re-import. HTML saves keep everything in `data-*` attributes. PDF/print render the live page.
- **Performance** — downscale on insert (1920px display, 2560px master), `loading="lazy"` images, debounced persistence for large docs.

### API keys

AI/stock features need your own keys (never bundled). Keys are saved with `secrets:set/get` (Electron `safeStorage` → OS keychain; session-only fallback where unavailable). Endpoints and models persist in normal settings.

### Tests

```powershell
npm test   # 70+ tests incl. resize/crop math, export plans, AI/stock parsers, save-load round-trips
```
