import * as path from "path";
import * as vscode from "vscode";
import { toSpeakable } from "./speakable";

type LoadMessage = {
  type: "load";
  title: string;
  segments: string[];
  voice: string;
};

let panel: vscode.WebviewPanel | undefined;
let webviewReady = false;
let pendingLoad: LoadMessage | undefined;

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("narrado.read", () => readAloud(context))
  );
}

export function deactivate(): void {}

function readAloud(context: vscode.ExtensionContext): void {
  const editor = findMarkdownEditor();
  if (!editor) {
    vscode.window.showWarningMessage("Narrado: open a markdown file first.");
    return;
  }

  const config = vscode.workspace.getConfiguration("narrado");
  const voice = config.get<string>("voice", "af_heart");
  const readCodeBlocks = config.get<boolean>("readCodeBlocks", false);

  const doc = editor.document;
  const segments = toSpeakable(doc.getText(), { readCodeBlocks });
  if (segments.length === 0) {
    vscode.window.showInformationMessage("Narrado: nothing to read in this document.");
    return;
  }

  const title = path.basename(doc.fileName);
  pendingLoad = { type: "load", title, segments, voice };

  if (panel) {
    panel.reveal(vscode.ViewColumn.Beside, true);
  } else {
    panel = createPanel(context);
  }

  if (webviewReady) {
    flushPendingLoad();
  }
}

function findMarkdownEditor(): vscode.TextEditor | undefined {
  const active = vscode.window.activeTextEditor;
  if (active?.document.languageId === "markdown") return active;
  return vscode.window.visibleTextEditors.find(
    (e) => e.document.languageId === "markdown"
  );
}

function createPanel(context: vscode.ExtensionContext): vscode.WebviewPanel {
  const p = vscode.window.createWebviewPanel(
    "narrado",
    "Narrado",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "dist"),
        vscode.Uri.joinPath(context.extensionUri, "media"),
      ],
    }
  );

  p.webview.html = getHtml(p.webview, context.extensionUri);

  p.webview.onDidReceiveMessage(
    (msg: { type: string; message?: string }) => {
      if (msg.type === "ready") {
        webviewReady = true;
        flushPendingLoad();
      } else if (msg.type === "error") {
        vscode.window.showErrorMessage("Narrado: " + (msg.message ?? "unknown error"));
      }
    },
    undefined,
    context.subscriptions
  );

  p.onDidDispose(
    () => {
      panel = undefined;
      webviewReady = false;
      pendingLoad = undefined;
    },
    undefined,
    context.subscriptions
  );

  return p;
}

function flushPendingLoad(): void {
  if (!panel || !pendingLoad) return;
  panel.webview.postMessage(pendingLoad);
  pendingLoad = undefined;
}

function getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "dist", "player.js")
  );
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "media", "player.css")
  );
  const csp = webview.cspSource;
  // The TTS engine fetches model weights from huggingface.co and may pull
  // WASM/worker assets from a CDN — every directive below is load-bearing.
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${csp} 'unsafe-inline'; font-src ${csp}; img-src ${csp} blob: data:; script-src ${csp} https: 'wasm-unsafe-eval'; connect-src https: blob: data:; media-src blob: data: ${csp}; worker-src blob:;" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${styleUri}" />
  <title>Narrado</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
}
