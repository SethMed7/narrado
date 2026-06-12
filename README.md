# narrado

> Press play on your markdown.

Narrado adds a ▶ button to every markdown editor in VS Code and Cursor. Press it and the
document is read aloud with a natural neural voice — generated entirely on your machine by
[Kokoro-82M](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX). No cloud, no API
keys, no accounts.

## Features

- ▶ play button in the editor title bar of any markdown file
- On-device TTS via [kokoro-js](https://github.com/hexgrad/kokoro) — free and private
- Markdown-aware narration: links read as their text, code blocks are skipped (configurable),
  tables read row by row, URLs never read aloud
- Starts speaking after the first sentence — no waiting for the whole document to render
- Live transcript in the player: the line being read is highlighted as it's spoken
- Click any line in the transcript to jump playback there
- Pause / resume, playback speed, and 25+ voices (US/British, male/female)

## Install

From a `.vsix` release (use the full path to the file):

```sh
cursor --install-extension /path/to/narrado-0.2.0.vsix   # Cursor
code --install-extension /path/to/narrado-0.2.0.vsix     # VS Code
```

Then **reload the window** (Cmd+Shift+P → "Developer: Reload Window") — already-open
windows don't pick up newly installed extensions until reloaded.

Marketplace / Open VSX: soon.

## First run

The first time you press play, the player panel downloads the Kokoro model (~80 MB, one
time). After that it works offline.

## Settings

| Setting | Default | Description |
| --- | --- | --- |
| `narrado.voice` | `af_heart` | Default Kokoro voice (`af`/`am` US, `bf`/`bm` British) |
| `narrado.readCodeBlocks` | `false` | Read code blocks aloud instead of skipping them |

## Development

```sh
bun install
bun run typecheck
bun test
bun run build      # bundles extension host (node/cjs) + webview player (browser)
bun run package    # produces narrado-x.y.z.vsix
```

Press F5 in VS Code to launch an Extension Development Host.

## License

MIT
