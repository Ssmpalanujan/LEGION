# Changelog

## Images Phase 4 — Extras
- Photo grid / collage layouts (2 across, 3 across, 2×2, stacked, 3×2) via `imageGroup` containers.
- Picture styles gallery (8 one-click presets) in Picture Format.
- Native right-click picture menu: Edit, Crop, Rotate, Flip, Copy Picture, Save as Picture, Set as Page Background, Remove Background, Extract Text.
- Export picture as PNG / JPG / WebP with scale + quality controls.
- Webcam capture (`getUserMedia`, camera permission granted for the app window).
- Screen clipping: screenshot + region select + insert.
- `initialTab` support in Smart Tools; camera permission handler; image save-dialog filters.
- Fixed: legacy `<img>` import dropped trailing human alt text after layout JSON.

## Images Phase 3 — Smart features
- Offline background removal (`@imgly/background-removal`, lazy-loaded; model cached after first run).
- OCR to text, English + Tamil (`tesseract.js`, lazy-loaded).
- AI alt-text suggestion over any OpenAI-compatible endpoint (own key).
- AI image generation panel (own key, downloads normalized to data URLs).
- Unsplash/Pexels search (own keys) with attribution + portable downloads.
- Emoji picker (insert at cursor) + 12 built-in SVG icons (insert as pictures).
- API keys in OS keychain via Electron `safeStorage` (`secrets:*` IPC), session fallback otherwise.

## Images Phase 2 — Built-in image editor
- Canvas editor modal on double-click: 9 adjustments (brightness → hue), 6 filter presets with live thumbnails, before/after slider.
- Annotations: pen, highlighter, arrow, rect, circle, text, blur/pixelate redact; modal undo/redo (Ctrl+Z/Y) isolated from document history.
- Non-destructive: master pixels + edit recipe on the node; reopen, reset supported.

## Images Phase 1 — Document handling
- Custom `atlasImage` Tiptap node (replaces stock image): handles, exact sizes, rotate/flip, aspect lock.
- Crop overlay with presets incl. circle; CSS-clipped display, baked-on-export.
- Wrap modes (inline/square/tight/behind/front), free positioning with snapping, alignment, layer order, group/ungroup.
- Picture Format side panel; insert from file/drop/paste/URL/screenshot.
- `.docx` export (size, crop, wrap, position, flip, border; webp/svg normalized) + alt-text layout round-trip on import; plain-`<img>` fallback preserved.
- Downscale-on-insert, lazy loading; keyboard access (arrows resize/move, Delete removes); tooltips throughout.
