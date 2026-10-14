#!/usr/bin/env bash
# profile-machine.sh — fingerprint this machine for AI coding agents.
#
# Agents: run `bash ~/dev-tools/profile-machine.sh` at task start and treat
# its output as the machine's truth. Anything NOT listed here is UNKNOWN —
# verify it yourself before relying on it; never fill gaps from memory.
#
# The output is a markdown profile, cached for 7 days (override: pass a
# number of days, e.g. `profile-machine.sh 0` forces a rebuild). The cache
# auto-invalidates when the hostname changes. Works on Git Bash, WSL,
# Linux, and macOS.
set -u

CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/machine-profile.md"
HOST="$(hostname 2>/dev/null || uname -n)"
MAX_AGE_DAYS="${1:-7}"

fresh_enough() {
  [ "$MAX_AGE_DAYS" = "0" ] && return 1   # 0 = always force rebuild
  [ -f "$CACHE" ] || return 1
  head -1 "$CACHE" | grep -qx "# machine: $HOST" || return 1
  [ -n "$(find "$CACHE" -mtime "-$MAX_AGE_DAYS" -print -quit 2>/dev/null)" ]
}

if ! fresh_enough; then
  mkdir -p "$(dirname "$CACHE")"
  {
    echo "# machine: $HOST"
    echo "- generated: $(date -Iseconds 2>/dev/null || date)"
    echo "- os: $(uname -s) $(uname -rm)"
    echo "- home: $HOME"
    for t in node npm pnpm yarn bun uv python python3 go rustc cargo git bash gh rg tsc code; do
      if command -v "$t" >/dev/null 2>&1; then
        if [ "$t" = go ]; then
          v="$("$t" version 2>/dev/null | head -1)"
        else
          v="$("$t" --version 2>/dev/null | head -1)"
        fi
        echo "- $t: ${v:-installed (version unknown)} — $(command -v "$t")"
      fi
    done
    if [ -f "$HOME/dev-tools/machines/$HOST.md" ]; then
      echo "- quirks: read ~/dev-tools/machines/$HOST.md (this machine has known quirks)"
    fi
  } > "$CACHE"
fi

cat "$CACHE"
