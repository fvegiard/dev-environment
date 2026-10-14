#!/usr/bin/env bash
# test-profile-machine.sh — prove profile-machine.sh covers every angle.
# Each test prints PASS or FAIL; exits non-zero on any failure.
set -u

# Prefer ./profile-machine.sh next to this test (repo checkout); fall back to
# the installed copy. Override with PROFILE_MACHINE_SH=/path/to/script.
if [ -n "${PROFILE_MACHINE_SH:-}" ]; then
  SCRIPT="$PROFILE_MACHINE_SH"
elif [ -f "$(dirname "$0")/profile-machine.sh" ]; then
  SCRIPT="$(cd "$(dirname "$0")" && pwd)/profile-machine.sh"
else
  SCRIPT="$HOME/dev-tools/profile-machine.sh"
fi
# Set XDG_CACHE_HOME per runner to isolate parallel runs.
CACHE="${XDG_CACHE_HOME:-$HOME/.cache}/machine-profile.md"
FAIL=0

check() { # name condition
  if eval "$2"; then echo "PASS: $1"; else echo "FAIL: $1"; FAIL=1; fi
}

# 1. Cold cache: profile is generated from nothing.
rm -f "$CACHE"
out="$(bash "$SCRIPT")"
check "cold cache generates profile" '[ -f "$CACHE" ]'
check "profile lists machine hostname" 'grep -qx "# machine: $(hostname)" <<< "$out"'
check "profile detects node version" 'grep -q "^- node: v" <<< "$out"'
check "profile detects python version" 'grep -q "^- python: Python " <<< "$out"'
check "profile detects go version" 'grep -q "^- go: go version" <<< "$out"'
check "profile shows resolved paths" 'grep -q "^- git: .* — " <<< "$out"'

# 2. Cache hit: second run does not regenerate (mtime unchanged).
m1="$(stat -c %Y "$CACHE")"; sleep 1
bash "$SCRIPT" >/dev/null
m2="$(stat -c %Y "$CACHE")"
check "fresh cache is reused" '[ "$m1" = "$m2" ]'

# 3. Stale cache: older than 7 days triggers rebuild.
touch -d "8 days ago" "$CACHE"; m1="$(stat -c %Y "$CACHE")"
bash "$SCRIPT" >/dev/null
m2="$(stat -c %Y "$CACHE")"
check "stale cache (>7d) rebuilds" '[ "$m1" != "$m2" ]'

# 4. Hostname mismatch: cache from another machine is not trusted.
sed -i "s/^# machine: .*/# machine: some-other-pc/" "$CACHE"
bash "$SCRIPT" >/dev/null
check "hostname mismatch rebuilds" 'grep -qx "# machine: $(hostname)" "$CACHE"'

# 5. Force rebuild with 0 days.
m1="$(stat -c %Y "$CACHE")"; sleep 1
bash "$SCRIPT" 0 >/dev/null
m2="$(stat -c %Y "$CACHE")"
check "profile-machine.sh 0 forces rebuild" '[ "$m1" != "$m2" ]'

# 6. Quirks file present → advertised in profile.
out="$(bash "$SCRIPT" 0)"
check "quirks file is advertised" '<<< "$out" grep -q "quirks: read .*machines/$(hostname).md"'

# 7. Quirks file absent → no false advertisement (simulate via temp HOME).
tmp="$(mktemp -d)"
mkdir -p "$tmp/dev-tools"
cp "$SCRIPT" "$tmp/dev-tools/"
unset_noglob="$(cd "$tmp" && HOME="$tmp" bash dev-tools/profile-machine.sh 0)"
check "no quirks line when no quirks file" '! <<< "$unset_noglob" grep -q "quirks:"'
rm -rf "$tmp"

# 8. Missing cache dir is created from scratch.
rm -rf "${XDG_CACHE_HOME:-$HOME/.cache}/machine-profile.md" 2>/dev/null
tmphome="$(mktemp -d)"
mkdir -p "$tmphome/dev-tools/machines"
cp "$SCRIPT" "$tmphome/dev-tools/"
HOME="$tmphome" XDG_CACHE_HOME= bash "$tmphome/dev-tools/profile-machine.sh" >/dev/null
check "cache dir auto-created" '[ -f "$tmphome/.cache/machine-profile.md" ]'
rm -rf "$tmphome"

# 9. Unknown tools are omitted, not faked.
out="$(bash "$SCRIPT" 0)"
check "no fake entries for absent tools" '! <<< "$out" grep -q "version unknown.* node"'

# 10. Output is valid markdown list lines and script is idempotent.
check "every line is header or bullet" '! <<< "$out" grep -vqE "^(# machine:|- )"'
check "repeated runs produce identical content" '[ "$(bash "$SCRIPT")" = "$(bash "$SCRIPT")" ]'

echo "---"
[ "$FAIL" = 0 ] && echo "ALL PASS" || echo "FAILURES PRESENT"
exit "$FAIL"
