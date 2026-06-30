#!/usr/bin/env bash
#
# dev.sh — start the backend (NestJS, :3000) and family frontend (Vite, :5173) together for local dev,
# optionally with the staff reviewer portal (Vite, :5174).
#
# Monorepo-only convenience: orchestrates the subprojects at once. It does NOT set up Postgres —
# do the one-time DB setup from backend/README.md first (create the blsb role + blsb_dev database,
# then `npx prisma migrate dev` + `npm run seed`). This script only runs the dev servers.
#
# Usage:   ./dev.sh           # backend + family frontend, prefixed logs, Ctrl-C stops them
#          ./dev.sh api       # backend only
#          ./dev.sh web       # family frontend only (:5173)
#          ./dev.sh review    # staff reviewer portal only (:5174)
#          ./dev.sh all       # backend + family frontend + reviewer portal
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
REVIEWER="$ROOT/reviewer"
TARGET="${1:-both}"

# Prefix every line of a child's output so interleaved logs stay readable.
prefix() { while IFS= read -r line; do printf '%s %s\n' "$1" "$line"; done; }

# Ensure a subproject is runnable: copy .env from the example if missing, install deps if missing.
prepare() {
  local dir="$1" name="$2" install_cmd="$3"
  if [ ! -f "$dir/.env" ] && [ -f "$dir/.env.example" ]; then
    echo "[$name] no .env — copying from .env.example"
    cp "$dir/.env.example" "$dir/.env"
  fi
  if [ ! -d "$dir/node_modules" ]; then
    echo "[$name] installing dependencies ($install_cmd)…"
    ( cd "$dir" && eval "$install_cmd" )
  fi
}

pids=()

# Kill a process and all its descendants — `npm run` spawns node→nest/vite, so killing only the
# tracked pipeline subshell would orphan the real server (and leave its port bound). pgrep is on
# both macOS and Linux.
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}
cleanup() {
  trap - INT TERM EXIT
  local pid
  for pid in "${pids[@]:-}"; do [ -n "$pid" ] && kill_tree "$pid"; done
}
trap cleanup INT TERM EXIT

if [ "$TARGET" = "both" ] || [ "$TARGET" = "all" ] || [ "$TARGET" = "api" ]; then
  prepare "$BACKEND" api "npm ci"
  ( cd "$BACKEND" && npm run start:dev 2>&1 | prefix "[api]" ) &
  pids+=($!)
fi

if [ "$TARGET" = "both" ] || [ "$TARGET" = "all" ] || [ "$TARGET" = "web" ]; then
  prepare "$FRONTEND" web "npm install"
  ( cd "$FRONTEND" && npm run dev 2>&1 | prefix "[web]" ) &
  pids+=($!)
fi

if [ "$TARGET" = "all" ] || [ "$TARGET" = "review" ]; then
  prepare "$REVIEWER" review "npm install"
  ( cd "$REVIEWER" && npm run dev -- --port 5174 2>&1 | prefix "[review]" ) &
  pids+=($!)
fi

if [ ${#pids[@]} -eq 0 ]; then
  echo "Unknown target '$TARGET' (expected: both | all | api | web | review)" >&2
  exit 1
fi

echo "▶ backend → http://localhost:3000/api/v1   ·   family → http://localhost:5173   ·   review → http://localhost:5174   (Ctrl-C to stop)"
wait
