# Environment Map — fvegiard (verified live 2026-10-04)

## Identity & accounts
- GitHub: `fvegiard` / `fvegiard@hotmail.com` (gh credential helper)
- Editor: Zed (`core.editor`), also VS Code, Cursor, Neovim, Warp
- Persona: **Mavis** (engine-independent)

## Source-of-truth repos (git)
| Repo | Path | Purpose |
|---|---|---|
| `C:\Copilot\llm-config-audit` | — | LLM config audit: master AGENTS.md, audits, scripts, tests, configs |
| `C:\AgentRuntimes` | — | Per-tool npm runtimes + `bin/agent-verify.ps1` |
| `fvegiard/OpenHands` | `D:\github\OpenHands` | fork |
| `OpenHands/OpenHands` | `D:\github\OpenHands_OpenHands` | upstream |
| `fvegiard/unified-agent-gateway` | `D:\github\unified-agent-gateway` | gateway |

## LLM CLIs (installed)
claude (2.1.283), codex (0.157.1), kimi (2.1.1), omp (18.3.2), pi (0.87.1),
cursor-agent, opencode (1.18.33), cline, droid, omo, desktop-commander,
gemini/antigravity (2.19.1), Grok Bot (0.61.0), Kiro CLI, OpenClaw Companion,
Qwen, WarpAgentCLI, Copilot CLI, GitHub Copilot CLI.

## Agent runtimes (C:\AgentRuntimes\bin + per-tool npm-global)
claude-acp, cline, desktop-commander, droid, mcp, omo, opencode, pi.
MCP servers: chrome-devtools, mcp-pdf-server, playwright-mcp.

## Docker (ai-nodes stack + more)
- ai-nodes: ai-router, ai-claude, ai-codex, ai-pi, ai-dev, ai-tools
- ollama (docker), open-webui (v0.11.4), openhands (1.8), agent-canvas
- n8n, gitlab-ce (19.4.1) + gitlab-runner, qdrant, dozzle, shell-arena
- cdp-chrome (headless), ai-selfheal, ai-tools

## Ollama
- Desktop: `AppData\Local\Programs\Ollama\ollama.exe` on 11434 (9+ models)
- Docker container `ollama`: gemma4:12b, llama3.2:1b
- PAIR (NVIDIA Personal AI Router): stopped; collision risk on 11434 if relaunched

## WSL distros
Ubuntu (default), docker-desktop, debian, ubuntu-resolute (PERSONAL — never touch),
Ubuntu-26.04 (use for Linux), kali-linux.

## VM / test targets (the "test on VM" gate)
Real virtual machines — NOT the Chrome "V8 VM" flag (that's just the JS engine internals).

### Hyper-V VMs (Windows test targets)
| VM | State | vCPU | Disk | Purpose |
|---|---|---|---|---|
| Codex-ACP-Kahnawake | Off | 6 | `C:\Users\fvegi\HyperV\CodexACP\packer-output\...\codex-acp-base-builder.vhdx` | Codex ACP base (Packer-built) |
| Windows 10 MSIX packaging environment | Off | 12 | `...\Windows 10 MSIX packaging environment (1).vhdx` | MSIX packaging |
| Windows 10 MSIX packaging environment | Running | 4 | `..._60E4C8FE-...avhdx` | MSIX packaging (active) |

SSH keys for VMs: `codex_acp_vm_ed25519`, `msix_vm_ed25519`.

### WSL distros (Linux test targets)
Ubuntu (default), Ubuntu-26.04 (full second stack), debian, kali-linux.
`ubuntu-resolute` = PERSONAL, never touch. `docker-desktop` = Docker's own VM.

### Not installed
VMware, VirtualBox — absent. Hyper-V + WSL2 are the only virtualization layers.

### Browser VM (v86 — WebAssembly x86 emulator) — NOT what OpenClaw uses
> ⚠️ **Correction (2026-10-04):** this v86 full-OS emulator is a *separate, heavy* capability.
> It is **not** what OpenClaw uses. OpenClaw's "browser" is Playwright automation of a real
> Chromium browser, and its "VM" is a Node.js `vm` JS sandbox (see "OpenClaw browser/VM" below).
> v86 is kept only as an optional "real Linux in the browser" experiment.

A real Linux VM that runs **entirely in the browser** (no server-side VM, 100% client-side WASM).
- **Engine**: v86@0.5.470 (x86 emulator → WebAssembly JIT). 32-bit only (no 64-bit kernels).
- **Guest**: Buildroot Linux, kernel 2.6.34.14, i686, busybox/ash shell. Boots to `/root%` prompt.
- **Assets** (in `files/v86-work/`): `package/build/libv86.js` + `v86.wasm`, `bios/seabios.bin` + `vgabios.bin`, `images/linux.iso` (6.5MB Buildroot).
- **Serve**: `python -m http.server 8791` from `files/v86-work/` (`.wasm` must be `application/wasm`; `file://` is blocked).
- **Load**: browser MCP → `http://127.0.0.1:8791/index.html`.
- **Container browser (cdp-chrome)**: was Chrome 151 headless-shell on `ws://127.0.0.1:9334`. ✅ verified booted + interactive, then **stopped** (consolidated on Chrome 157).
- **Interact programmatically**: `window.emulator.keyboard_send_text("cmd\n")` (US layout). Verified: `uname -a`, `ls -la /` both work.
- **Status**: ✅ booted + interactive (verified 2026-10-04).
- **Upgrade path**: Alpine Linux (apk package manager) via `tools/docker/alpine/build.sh` (Docker, i386/alpine base → alpine-fs.json + alpine-rootfs-flat, 9p filesystem).

### OpenClaw browser/VM (the "very light" model — this is what OpenClaw actually uses)
OpenClaw (personal AI assistant harness, fork of Clawdbot/Moltbot) does **not** run a full OS VM.
Its "browser" and "VM" are two separate, much lighter things:
- **`browser` tool = Playwright automation** — drives a *real* Chromium browser over CDP (same as the
  Playwright MCP). Actions: `open`/`navigate`/`snapshot`/`act`/`tabs`/`text`/`requests`/`errors`.
  Profiles: managed (isolated) or `profile="user"` (attach to the running browser). No OS emulation.
- **`exec` cells (Code Mode) = a "fresh VM" per cell** — a **Node.js `vm` sandbox** (isolated JS
  execution context), not an OS. "Very light" because it's just a JS context with millisecond startup;
  bindings don't persist between cells (only `waiting` runs keep state).
- **Models**: OpenClaw → Ollama (`http://127.0.0.1:11434`), many models incl. deepseek-v4-pro:cloud,
  claude-opus-5, glm-5.3, kimi-k3, minimax-m3, hermes3.6-35b, ornith:9b, qwen2.5:0.5b.
- **Config**: `~/.openclaw-mxlinux/openclaw.json` (skills/plugins), `agents/main/agent/models.json`
  (Ollama provider), `plugin-skills/browser-automation/SKILL.md` + `canvas/SKILL.md`.
- **Takeaway**: the "light VM in the browser" = Playwright (real browser) + JS sandbox (exec cells).
  This is the model to follow, not v86.

### Desktop Commander — the concrete "browser shell" (what the user means by "VM in browser")
Desktop Commander (`@wonderwhy-er/desktop-commander`, MCP server) is the concrete example of the
"browser shell" the user is referring to. Its **Remote MCP** web UI (`https://mcp.desktopcommander.app`)
is a browser-based terminal: you open it in the browser and it runs commands on the **real host**
machine (config `defaultShell: "bash.exe"`). It is **not** a VM — no OS emulation, no WASM kernel.
- **What it provides**: terminal/shell (start_process, read_process_output, interact_with_process,
  list_processes, kill_process), filesystem (read/write/edit/search/move), in-memory code exec
  (Python/Node/R), Excel/PDF/DOCX support, process/session management.
- **How it's wired here**: OAuth Remote MCP client (`~/.kimi-code/credentials/mcp/desktop-commander-*.json`,
  client_id/secret, redirect to `127.0.0.1:52637/callback`). Heavily used: 7,479 tool calls, 137 sessions.
- **The mental model**: "VM in browser" = **browser shell** (web UI → host terminal), NOT a full OS
  emulator. v86 (full x86 OS in WASM) is a different, heavier thing and is not what the user wants.

## Browsers (canonical: Chrome Dev 157 only)
- **Chrome Dev 157.0.8081.0** — `C:\Program Files\Google\Chrome Dev\Application\chrome.exe`, debug port **9222** (`--remote-debugging-address=127.0.0.1`). The single browser for everything.
- **Playwright MCP** → `--executable-path C:\Program Files\Google\Chrome Dev\Application\chrome.exe` (was Chrome 154 stable). Config: `C:\Users\fvegi\.copilot\mcp-config.json`.
- **Retired**: Chrome 151 container (cdp-chrome, port 9334) — stopped; Edge 155 (port 9223) — stopped; Chrome 154 stable — no longer used by MCP.
- Nothing in 151 is missing from 157: 157 is newer and can run headless via `--headless=new`.

## API keys / tokens present (names only, values never printed)
BRAVE_API_KEY, CLOUDFLARE (ACCOUNT_ID, API_TOKEN, R2 x3), EXA_API_KEY, HF_TOKEN,
NVIDIA_API_KEY, OLLAMA_API_KEY, OPENCODE_API_KEY, OPENROUTER_API_KEY,
VIRUSTOTAL_API_KEY, NETLIFY_AUTH_TOKEN, GH_TOKEN, GITHUB_TOKEN,
CLAUDE_CODE_OAUTH_TOKEN.

## SSH keys
id_ed25519, cline_wsl_ed25519, codex_acp_vm_ed25519, msix_vm_ed25519.

## Config dirs (LLM-related)
.claude, .codex, .kimi-code, .kimi_openclaw, .kimi-webbridge, .kimi-work,
.gemini, .cursor, .opencode, .cline, .openhands, .openclaw, .omc, .omp, .pi,
.grokbot, .cagent, .kiro, .senpi, .elyntic, .factory, .gateguard, .tabby-client,
.mcp-auth, .mcp-inspector, .playwright-mcp, .windows-mcp, .desktop-commander,
.claude-server-commander, .cua-driver, .icube-remote-ssh, .impeccable, .kilo.

## Key contract files
- Master: `C:\Copilot\llm-config-audit\agent-kit\AGENTS.md` (+ CLAUDE.md, AUTONOMY.md)
- Deployed: `~/.agents/AGENTS.md`, `~/.codex/AGENTS.md`, `~/.claude/CLAUDE.md`
- Anti-hallucination sources: `~/.agents/AGENTIC-DOCS.md`
- Machine state: `~/.agents/MACHINE-STATE-VERIFIED-2026-09-26.md`
- LLM ports: `~/.agents/LLM-PORTS-CURRENT-2026-09-26.md`
- Mavis persona also in: `~/.gemini/GEMINI.md`, `~/.cline/rules/mavis-persona.md`

## Per-tool MCP servers
- Kimi (`~/.kimi-code/mcp.json`): chrome-devtools-docker, desktop-commander, kimi-cu, pair-knowledge, windows-mcp
- Cursor (`~/.cursor/mcp.json`): windows-mcp
- MCP inspector: filesystem, everything, example (defaults)
- AgentRuntimes/mcp: chrome-devtools, mcp-pdf-server, playwright-mcp

## Editor / toolchain config
- Zed agent servers: Claude ACP (`claude-agent-acp`), OpenCode (`opencode acp`)
- mise (`~/.config/mise/config.toml`): node 26.10.0, npm 12.2.0, uv 0.12.18
- OpenHands: CodeActAgent, model gpt-5.6, reasoning high
- OpenClaw (`~/.kimi_openclaw/openclaw.json`): models, agents, plugins, gateway, browser, channels, tools
- pi (`~/.pi/agent`): mcp.json, models.json, ollama_cloud.json, settings.json, skills/manage-flows
- Cline: rules/mavis-persona.md, apps/kanban

## WSL side (Ubuntu-26.04 — full second stack)
Own `.claude`, `.codex`, `.openhands`, `.pi`, `.omp`, `.opencode`, `.omo`, `.n8n`,
`.nvm`, mise shims (node/npm/omp), `~/.local/bin/claude`.
`ubuntu-resolute` (personal): `~/project/` = 9 tinder repos
(TinderBotz, TinderGPT, Tinder_Automation_Bot, auto-tinder, tinder-autopilot,
tinder-bot, tinder-telegram-bot, tinder-unified, tindetheus) + AGENTS.md + al_schema.sql.
