<div align="center">

![narrado — press play on your markdown](assets/banner.png)

**On-device text-to-speech for VS Code and Cursor — no cloud, no API keys, no accounts.**

[![Release](https://img.shields.io/github/v/release/SethMed7/narrado?color=5B8CFF&label=release)](https://github.com/SethMed7/narrado/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-5B8CFF)](LICENSE)
[![Editors](https://img.shields.io/badge/VS%20Code%20%C2%B7%20Cursor-1.90%2B-0B0C10)](#install)
[![TTS](https://img.shields.io/badge/Kokoro--82M-on--device-5B8CFF)](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)

</div>

Narrado puts a `▶` on every markdown file. Press it and the document is read aloud in a
natural neural voice — synthesized entirely on your machine by
[Kokoro-82M](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX) running inside the
editor. No request leaves your computer. No account. No key. Just a quiet, precise reading
instrument that lives in your sidebar.

<div align="center">

![The narrado player — live transcript, click any line to jump](assets/player.png)

</div>

## Why narrado

Documentation, RFCs, release notes, that long PR description — some markdown is easier to
*hear* than to read. Narrado turns any `.md` into spoken audio without sending a single
byte to a server, and gives you a live transcript so you can follow along, skim back, and
jump to any line.

## Features

- **`▶` everywhere** — a status-bar button, the editor title bar, and the command palette
  (`Narrado: Read Aloud`). Works from the raw source view *and* the rendered preview.
- **Fully on-device** — synthesis runs locally via
  [kokoro-js](https://github.com/hexgrad/kokoro). Free, private, and fully offline after a
  one-time model download.
- **Live transcript** — the spoken line is highlighted as it's read. Click any line to
  jump playback straight to it.
- **Markdown-aware narration** — links are read as their text, code blocks are skipped by
  default (configurable), tables are read row by row, and raw URLs are never spoken aloud.
- **Instant start** — narration begins after the first sentence; the rest of the document
  is prepared while you're already listening.
- **Full transport** — pause and resume, adjust playback speed, and choose from 25+ voices
  (US / British, male / female).

## Install

Download the latest `.vsix` from
[**Releases**](https://github.com/SethMed7/narrado/releases/latest), then either:

- **In the editor** — Extensions panel → `…` menu → **Install from VSIX…** → pick the file, or
- **From the terminal** — use the full path to the downloaded file:

```sh
cursor --install-extension /path/to/narrado-0.3.0.vsix   # Cursor
code   --install-extension /path/to/narrado-0.3.0.vsix   # VS Code
```

Then **reload the window** (`Cmd+Shift+P` → *Developer: Reload Window*) — already-open
windows don't pick up a newly installed extension until they're reloaded.

> Marketplace / Open VSX: soon.

## First run

The first time you press play, the player panel downloads the Kokoro model (~80 MB, once).
After that, narrado runs entirely offline.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `narrado.voice` | `af_heart` | Default Kokoro voice (`af` / `am` US, `bf` / `bm` British) |
| `narrado.readCodeBlocks` | `false` | Read code blocks aloud instead of skipping them |

## Development

```sh
bun install
bun run typecheck
bun test
bun run build      # bundles extension host (node/cjs) + webview player (browser)
bun run package    # produces narrado-x.y.z.vsix
```

Press `F5` in VS Code to launch an Extension Development Host. Brand assets (banner, social
card, player shot) are authored as HTML/SVG in `assets/` and rendered with
`bunx playwright screenshot`.

## License

MIT

---

<div align="center">
<sub><b>narrado</b> &middot; electric blue on near-black, set in mono &middot; a reading instrument &mdash; built with <a href="https://bun.sh">Bun</a> + <a href="https://github.com/hexgrad/kokoro">Kokoro</a></sub>
<br />
<sub>Sibling project: <a href="https://github.com/SethMed7/leelo">leelo</a> — same engine, a deliberately different voice (light, warm, playful). A pair, not twins.</sub>
</div>
