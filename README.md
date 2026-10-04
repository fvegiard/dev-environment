# dev-environment

> **One browser. Everything else inside it.**
> Docker · WSL2 · shell · SSH — consolidated into a single Chrome Dev 157 surface,
> powered by on-device AI (Gemma 4), WebGPU, WebNN, and WebAssembly.

This is the **dev environment** for Francis (fvegiard). It is the single place where
the whole machine — containers, Linux distros, terminals, remote hosts, and the
browser's own built-in intelligence — lives behind one URL.

---

## What this is

A consolidation of four things that used to be four separate tools:

| Before (separate) | After (one place) |
|---|---|
| Docker Desktop / `docker` CLI | `linuxserver/webtop` — full Ubuntu+Xfce desktop in a browser tab |
| WSL2 distros (Ubuntu, Debian, Kali) | reachable from the same browser shell |
| Shell (PowerShell / bash) | browser terminal (Desktop Commander / webtop) |
| SSH to VMs / remote hosts | same browser, same session |

The browser is **Chrome Dev 157** (`157.0.8081.0`), the single canonical browser.
Its built-in AI runs **on-device** — no API key, no data leaving the machine.

---

## The five layers

1. **Built-in AI** — Gemma 4 on-device LLM (Prompt / Summarizer / Writer / Rewriter /
   Translator / Language Detector APIs).
2. **WebGPU** — raw GPU compute (NVIDIA RTX 5090, 24 GB VRAM).
3. **WebNN** — hardware-accelerated neural-network inference (NPU/GPU).
4. **WebAssembly** — near-native JIT (threads, stack-switching, tiering).
5. **Web platform + tooling** — CDP automation, webtop desktop, v86 OS-in-browser.

Full flag-by-flag documentation: [`docs/chrome-flags.md`](docs/chrome-flags.md).
25 primary references: [`docs/references.md`](docs/references.md).

---

## Repository layout

```
dev-environment/
├── README.md                  ← this file
├── .gitignore
├── docs/
│   ├── chrome-flags.md        ← all 20 experimental flags, code examples, benefits
│   └── references.md          ← 25 primary references (specs, docs, repos)
├── scripts/
│   ├── set-flags.js           ← apply the 12 flags via CDP (chrome://flags)
│   ├── cdp-eval.js            ← evaluate JS on a Chrome Dev tab via CDP
│   ├── stream-chrome.js       ← stream the page viewport (CDP remote control)
│   ├── stream-window.js       ← stream the FULL window (chrome UI + content)
│   └── input-helper.ps1       ← OS-level input injector (SendInput) for stream-window
├── webtop/
│   └── docker-compose.yml     ← the Ubuntu+Xfce desktop container
├── ENVIRONMENT-MAP.md         ← full machine map (Docker, WSL, VMs, keys, MCP)
├── OPERATING-CONTRACT.md      ← the Mavis persona + rules
└── environment-map.html       ← interactive force-directed graph (96 nodes)
```

---

## Quick start

### 1. Launch the browser (Chrome Dev 157, debug port 9222)

```powershell
& "C:\Program Files\Google\Chrome Dev\Application\chrome.exe" `
  --no-default-browser-check --no-first-run `
  --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222 `
  --user-data-dir="C:\Users\fvegi\.agent-browsers\chrome-dev-debug"
```

### 2. Apply the experimental flags

```powershell
node scripts/set-flags.js
```

Then restart Chrome Dev (kill all `chrome.exe` processes and relaunch with the
command above — the flags page's "Relaunch" button does not reliably restart).

### 3. Start the Linux desktop (webtop)

```powershell
docker compose -f webtop/docker-compose.yml up -d
# → http://localhost:3005  (Ubuntu + Xfce, served over Selkies)
```

### 4. Evaluate JS on any tab (CDP helper)

```powershell
node scripts/cdp-eval.js "navigator.userAgent"
```

### 5. Stream Chrome Dev 157 into the Copilot app (remote control)

Streams the **existing** Chrome Dev 157 (with all AI flags) into a web page — no new
browser launched. Open the URL in the Copilot browser canvas to see and control it.

```powershell
node scripts/stream-chrome.js
# → http://127.0.0.1:8791/
```

| Route | Purpose |
|---|---|
| `/` | remote-control UI |
| `/stream` | MJPEG video stream (`Page.captureScreenshot`) |
| `/metrics` | viewport size + target URL |
| `/input` | mouse/keyboard forwarding (`Input.dispatchMouseEvent` / `insertText`) |
| `/eval` | DOM evaluation (`Runtime.evaluate`) |

Control is **DOM + mouse**, not screenshots: `/eval` runs arbitrary JS in the page,
`/input` forwards real mouse/keyboard events. This is the same CDP protocol
Playwright/Puppeteer build on.

### 6. Stream the FULL window (chrome UI + content) — remote control

`stream-chrome.js` captures only the page viewport. `stream-window.js` captures the
**entire browser window** — tabs, address bar, toolbar, and page — using ffmpeg
`gdigrab`, and forwards mouse/keyboard at the **OS level** (SendInput), so clicking
tabs and the address bar works too, not just the page.

```powershell
node scripts/stream-window.js
# → http://127.0.0.1:8792/
```

| Route | Purpose |
|---|---|
| `/` | full-window remote-control UI |
| `/stream` | MJPEG video stream (ffmpeg `gdigrab` → whole window) |
| `/metrics` | window bounds + target URL |
| `/input` | OS-level mouse/keyboard (`SendInput` via `input-helper.ps1`) |
| `/eval` | DOM evaluation (`Runtime.evaluate`) |

Requires `ffmpeg` on PATH. The window bounds are auto-detected (DPI-aware) at
startup; input coordinates are normalized (0–1) and mapped back to absolute screen
coordinates.

---

## The answer to "did we consolidate docker/wsl2/shell/ssh into one place?"

**Yes — with one honest caveat.**

- **Docker** → yes, fully. The webtop container *is* Docker, surfaced as a desktop
  in the browser. Every other container (ollama, open-webui, n8n, gitlab, qdrant…)
  is reachable from that same browser.
- **Shell** → yes. The browser terminal (Desktop Commander / webtop) runs real
  commands on the host and inside containers.
- **SSH** → yes. SSH keys and remote hosts are all reachable from the same browser
  session; nothing requires a separate terminal app.
- **WSL2** → *mostly*. WSL distros are reachable from the browser shell, but WSL2 is
  a separate virtualization layer (Hyper-V) that the browser cannot *replace* — it
  can only *reach* it. The browser's own "VM" (v86) is a 32-bit WASM emulator, not a
  WSL2 replacement.

**Net:** the *surface* is one place (the browser). The *engines* underneath
(Docker, WSL2, Hyper-V) still exist — the browser is the single pane of glass over
all of them, plus its own on-device AI.

---

## Do we have the right tools for correction, all under 157?

**Yes.** Chrome Dev 157 is the newest channel and contains everything 151/154/155 had,
plus the built-in AI, WebGPU, WebNN, and WebAssembly flags documented here. Nothing
from the older versions is missing — 157 runs headless (`--headless=new`), drives via
CDP, and hosts the on-device model. The "correction" loop (edit → verify on VM →
commit → PR → CI green) is fully supported from this single browser.
