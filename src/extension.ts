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
let lastMarkdownDoc: vscode.TextDocument | undefined;

export function activate(context: vscode.ExtensionContext): void {
  if (vscode.window.activeTextEditor?.document.languageId === "markdown") {
    lastMarkdownDoc = vscode.window.activeTextEditor.document;
  }
  context.subscriptions.push(
    vscode.commands.registerCommand("narrado.read", (resource?: unknown) =>
      readAloud(context, resource)
    ),
    vscode.window.onDidChangeActiveTextEditor((e) => {
      if (e?.document.languageId === "markdown") lastMarkdownDoc = e.document;
    })
  );
}

export function deactivate(): void {}

async function readAloud(context: vscode.ExtensionContext, resource?: unknown): Promise<void> {
  const doc = await findMarkdownDoc(resource);
  if (!doc) {
    vscode.window.showWarningMessage("Narrado: open a markdown file first.");
    return;
  }

  const config = vscode.workspace.getConfiguration("narrado");
  const voice = config.get<string>("voice", "af_heart");
  const readCodeBlocks = config.get<boolean>("readCodeBlocks", false);

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

// The play button also lives on the rendered markdown preview, where there is
// no active text editor — resolve the document from (in order): the resource
// uri the title-bar menu passes, the active/visible editors, the last
// markdown editor that was focused, or the only open markdown document.
async function findMarkdownDoc(resource?: unknown): Promise<vscode.TextDocument | undefined> {
  if (resource instanceof vscode.Uri) {
    try {
      const doc = await vscode.workspace.openTextDocument(resource);
      if (doc.languageId === "markdown") return doc;
    } catch {
      // fall through to the editor-based lookups
    }
  }
  const active = vscode.window.activeTextEditor;
  if (active?.document.languageId === "markdown") return active.document;
  const visible = vscode.window.visibleTextEditors.find(
    (e) => e.document.languageId === "markdown"
  );
  if (visible) return visible.document;
  if (lastMarkdownDoc && !lastMarkdownDoc.isClosed) return lastMarkdownDoc;
  const open = vscode.workspace.textDocuments.filter(
    (d) => d.languageId === "markdown" && !d.isClosed
  );
  return open.length === 1 ? open[0] : undefined;
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
