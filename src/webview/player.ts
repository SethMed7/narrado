import { KokoroTTS, type GenerateOptions } from "kokoro-js";

type Voice = NonNullable<GenerateOptions["voice"]>;

interface VsCodeApi {
  postMessage(message: unknown): void;
}
declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();

const MODEL_ID = "onnx-community/Kokoro-82M-v1.0-ONNX";

const VOICES: Array<[Voice, string]> = [
  ["af_heart", "Heart (US female)"],
  ["af_alloy", "Alloy (US female)"],
  ["af_aoede", "Aoede (US female)"],
  ["af_bella", "Bella (US female)"],
  ["af_jessica", "Jessica (US female)"],
  ["af_kore", "Kore (US female)"],
  ["af_nicole", "Nicole (US female)"],
  ["af_nova", "Nova (US female)"],
  ["af_river", "River (US female)"],
  ["af_sarah", "Sarah (US female)"],
  ["af_sky", "Sky (US female)"],
  ["am_adam", "Adam (US male)"],
  ["am_echo", "Echo (US male)"],
  ["am_eric", "Eric (US male)"],
  ["am_fenrir", "Fenrir (US male)"],
  ["am_liam", "Liam (US male)"],
  ["am_michael", "Michael (US male)"],
  ["am_onyx", "Onyx (US male)"],
  ["am_puck", "Puck (US male)"],
  ["am_santa", "Santa (US male)"],
  ["bf_alice", "Alice (UK female)"],
  ["bf_emma", "Emma (UK female)"],
  ["bf_isabella", "Isabella (UK female)"],
  ["bf_lily", "Lily (UK female)"],
  ["bm_daniel", "Daniel (UK male)"],
  ["bm_fable", "Fable (UK male)"],
  ["bm_george", "George (UK male)"],
  ["bm_lewis", "Lewis (UK male)"],
];
const SPEEDS = ["0.75", "1", "1.25", "1.5", "2"];

// --- UI ---
const app = document.getElementById("app")!;
const titleEl = el("h1", "title");
const statusEl = el("div", "status");
const playBtn = el("button", "play") as HTMLButtonElement;
playBtn.textContent = "▶";
playBtn.title = "Play / Pause";
const stopBtn = el("button", "stop") as HTMLButtonElement;
stopBtn.textContent = "■";
stopBtn.title = "Stop";
const progressEl = el("span", "progress");
progressEl.textContent = "0 / 0";
const speedSel = document.createElement("select");
for (const s of SPEEDS) speedSel.add(new Option(`${s}×`, s, false, s === "1"));
const voiceSel = document.createElement("select");
for (const [id, label] of VOICES) voiceSel.add(new Option(label, id));

const controls = el("div", "controls");
controls.append(playBtn, stopBtn, progressEl);
const options = el("div", "options");
options.append(speedSel, voiceSel);
app.append(titleEl, statusEl, controls, options);

function el(tag: string, id: string): HTMLElement {
  const node = document.createElement(tag);
  node.id = id;
  return node;
}

// --- State ---
let runToken = 0;
let segments: string[] = [];
let clips: Blob[] = []; // kept after playback so Stop can restart from the top
let playIndex = 0;
let userPaused = false;
let waitingForClip = false; // playback caught up with generation
let generating = false;
let currentVoice: Voice = "af_heart";
let currentUrl: string | null = null;

const audio = new Audio();
audio.preservesPitch = true;

function setStatus(text: string): void {
  statusEl.textContent = text;
}

function updateProgress(): void {
  progressEl.textContent = `${Math.min(playIndex + 1, clips.length)} / ${segments.length}`;
}

function fail(message: string): void {
  setStatus(`Error: ${message}`);
  vscode.postMessage({ type: "error", message });
}

function dropUrl(): void {
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl);
    currentUrl = null;
  }
}

// --- TTS (lazy singleton) ---
let ttsPromise: Promise<KokoroTTS> | null = null;

function getTts(): Promise<KokoroTTS> {
  ttsPromise ??= initTts();
  return ttsPromise;
}

async function initTts(): Promise<KokoroTTS> {
  const progress_callback = (p: { status?: string; progress?: number }) => {
    if (p.status === "progress" && typeof p.progress === "number") {
      setStatus(`Downloading model — ${Math.round(p.progress)}% (one-time, ~80 MB)`);
    }
  };
  setStatus("Loading model…");
  try {
    return await KokoroTTS.from_pretrained(MODEL_ID, { device: "webgpu", dtype: "fp32", progress_callback });
  } catch {
    setStatus("WebGPU unavailable — falling back to WASM…");
    return await KokoroTTS.from_pretrained(MODEL_ID, { device: "wasm", dtype: "q8", progress_callback });
  }
}

// --- Generation ---
async function generateAll(token: number): Promise<void> {
  generating = true;
  try {
    const tts = await getTts();
    for (let i = 0; i < segments.length; i++) {
      if (token !== runToken) return;
      setStatus(`generating ${i + 1}/${segments.length}`);
      const out = await tts.generate(segments[i], { voice: currentVoice });
      if (token !== runToken) return;
      clips.push(toWav(out.audio, out.sampling_rate));
      updateProgress();
      if ((clips.length === 1 && !userPaused) || waitingForClip) {
        waitingForClip = false;
        playCurrent();
      }
    }
    if (token === runToken) setStatus(audio.paused ? "ready" : "playing");
  } catch (err) {
    if (token === runToken) fail(err instanceof Error ? err.message : String(err));
  } finally {
    if (token === runToken) generating = false;
  }
}

// Float32 [-1,1] -> 16-bit PCM mono WAV.
function toWav(samples: Float32Array, sampleRate: number): Blob {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buf);
  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i));
  };
  str(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  str(36, "data");
  view.setUint32(40, samples.length * 2, true);
  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buf], { type: "audio/wav" });
}

// --- Playback ---
function playCurrent(): void {
  const clip = clips[playIndex];
  if (!clip) {
    waitingForClip = true;
    return;
  }
  dropUrl();
  currentUrl = URL.createObjectURL(clip);
  audio.src = currentUrl;
  audio.playbackRate = Number(speedSel.value);
  void audio.play().catch((err: unknown) => fail(err instanceof Error ? err.message : String(err)));
  playBtn.textContent = "❚❚";
  setStatus(generating ? `generating ${clips.length}/${segments.length}` : "playing");
  updateProgress();
}

audio.addEventListener("ended", () => {
  dropUrl();
  playIndex++;
  if (playIndex < clips.length) {
    playCurrent();
  } else if (generating) {
    waitingForClip = true;
    setStatus(`generating ${clips.length}/${segments.length}`);
  } else {
    playIndex = 0;
    playBtn.textContent = "▶";
    userPaused = true;
    setStatus("done");
    updateProgress();
  }
});

playBtn.addEventListener("click", () => {
  if (!audio.paused) {
    audio.pause();
    userPaused = true;
    playBtn.textContent = "▶";
    setStatus("paused");
  } else {
    userPaused = false;
    if (currentUrl) {
      void audio.play();
      playBtn.textContent = "❚❚";
      setStatus(generating ? `generating ${clips.length}/${segments.length}` : "playing");
    } else {
      playCurrent();
    }
  }
});

stopBtn.addEventListener("click", () => {
  audio.pause();
  dropUrl();
  audio.removeAttribute("src");
  playIndex = 0;
  waitingForClip = false;
  userPaused = true;
  playBtn.textContent = "▶";
  setStatus("stopped");
  updateProgress();
});

speedSel.addEventListener("change", () => {
  audio.playbackRate = Number(speedSel.value);
});

// Applies only to segments not yet generated; already-queued clips keep their voice.
voiceSel.addEventListener("change", () => {
  currentVoice = voiceSel.value as Voice;
});

// --- Host messages ---
window.addEventListener("message", (event: MessageEvent) => {
  const msg = event.data as { type?: string; title?: string; segments?: string[]; voice?: string };
  if (msg?.type !== "load") return;
  runToken++;
  audio.pause();
  dropUrl();
  audio.removeAttribute("src");
  segments = msg.segments ?? [];
  clips = [];
  playIndex = 0;
  userPaused = false;
  waitingForClip = false;
  titleEl.textContent = msg.title ?? "";
  document.title = msg.title ?? "Narrado";
  if (msg.voice && VOICES.some(([id]) => id === msg.voice)) {
    voiceSel.value = msg.voice;
    currentVoice = msg.voice as Voice;
  }
  playBtn.textContent = "▶";
  updateProgress();
  if (segments.length === 0) {
    setStatus("nothing to read");
    return;
  }
  void generateAll(runToken);
});

vscode.postMessage({ type: "ready" });
