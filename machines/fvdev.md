# Machine quirks: fvdev (the Legion — Lenovo Legion 9 18IAX10, Windows 11)

Read this before relying on any machine-specific behavior here. Verify a fact
again if it matters; quirks drift after reinstalls.

## Shell

- Default shell for agents: **Windows Git Bash**, not WSL, not PowerShell.
  Never invoke powershell.exe, pwsh, PowerShell scripts, or cmdlets. For
  Windows administration use native tools from Bash (`reg`, `taskkill`,
  `wevtutil`, `node`).
- Three `bash.exe` are on PATH; only the first is Git Bash.
  `command -v bash` must print `/usr/bin/bash`. Paths look like
  `/c/Users/fvegi` and `/d/Github`.
- No `~/.bashrc`, `~/.bash_profile`, or `~/.profile` — a login shell (`-l`)
  loads nothing custom.
- Git Bash rewrites arguments that start with `/`. For native Windows tools
  double the slash (`tasklist //v`, `reg query "HKCU\Environment" //v NAME`),
  and drop the leading slash for `gh api user/...`.
- WSL2 (Ubuntu) is a separate world; use it only for Linux-specific work.

## Guardrails

- In Claude Code, `~/.claude/hooks/guard.js` blocks some recursive deletes
  (`rm -rf`) until Francis confirms. Delete named files instead, or ask him.
- `~/dev-tools/smoke-test.sh` (~1 min) verifies the whole machine: tool
  versions, install scripts, Rust/Go compile+link, git identity. Run it
  after any change to PATH, npm/pnpm config, Python, Node, Rust, or Build
  Tools. Fix every FAIL before moving on.

## Desktop Commander remote

- Check for an existing remote agent first; start only if absent:
  `npx -y @wonderwhy-er/desktop-commander@latest remote` (not `oz start`).
- Keep its session alive, reuse saved authentication, leave device approval
  to the user, verify connected/ready status. Never kill unrelated Node
  processes.

## Python

- uv-managed 3.14.7 is the default `python`/`python3`; `~/.local/bin` is
  first on the User PATH. There is no bare global `pip` — use `uv pip`,
  `uv venv`, `uv run`, `uv tool`.
