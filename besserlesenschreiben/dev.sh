#!/usr/bin/env bash
#
# dev.sh — start the backend (NestJS, :3000) and family frontend (Vite, :5173) together for local dev,
# optionally with the staff trainer portal (Vite, :5174).
#
# Monorepo-only convenience: orchestrates the subprojects at once. It does NOT set up Postgres —
# do the one-time DB setup from backend/README.md first (create the blsb role + blsb_dev database,
# then `npx prisma migrate dev` + `npm run seed`). This script only runs the dev servers.
#
# Usage:   ./dev.sh           # backend + family frontend, prefixed logs, Ctrl-C stops them
#          ./dev.sh api       # backend only
#          ./dev.sh web       # family frontend only (:5173)
#          ./dev.sh trainer    # staff trainer portal only (:5174)
#          ./dev.sh all       # backend + family frontend + trainer portal
#          ./dev.sh kill      # kill anything still listening on :3000/:5173/:5174 (a hung process
#                              #   from a previous run that didn't exit cleanly, e.g. after a crash
#                              #   or a closed terminal) — run this after an EADDRINUSE error, then
#                              #   start dev.sh again
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
TRAINER="$ROOT/trainer"
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
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}

# Kill whatever is listening on a dev port, tree-and-all — for a hung process left over from a
# previous run (crashed terminal, killed shell, etc.) that dev.sh's own cleanup trap never got to
# run for. `lsof -ti` lists just the PID(s) bound to the port; works on macOS and Linux.
kill_port() {
  local port="$1" label="$2" pid found=0
  for pid in $(lsof -ti "tcp:$port" 2>/dev/null || true); do
    echo "[$label] killing pid $pid on :$port"
    kill_tree "$pid"
    found=1
  done
  # An if/fi (not `test && echo`) so the function's own exit status is 0 either way — this runs as a
  # bare top-level statement, and set -e treats a false `&&` left-hand side as the function's failure.
  if [ "$found" -eq 0 ]; then
    echo "[$label] nothing listening on :$port"
  fi
}

if [ "$TARGET" = "kill" ]; then
  kill_port 3000 api
  kill_port 5173 web
  kill_port 5174 trainer
  exit 0
fi

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

if [ "$TARGET" = "all" ] || [ "$TARGET" = "trainer" ]; then
  prepare "$TRAINER" trainer "npm install"
  ( cd "$TRAINER" && npm run dev -- --port 5174 2>&1 | prefix "[trainer]" ) &
  pids+=($!)
fi

if [ ${#pids[@]} -eq 0 ]; then
  echo "Unknown target '$TARGET' (expected: both | all | api | web | trainer | kill)" >&2
  exit 1
fi

echo "▶ backend → http://localhost:3000/api/v1   ·   family → http://localhost:5173   ·   trainer → http://localhost:5174   (Ctrl-C to stop)"
wait
