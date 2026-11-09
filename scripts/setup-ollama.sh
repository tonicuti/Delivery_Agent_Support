#!/usr/bin/env bash
# Prepare a host-installed Ollama for the delivery agent: server up, qwen3:1.7b pulled and warm.
#
# Usage:
#   scripts/setup-ollama.sh                # pull model + smoke test
#   scripts/setup-ollama.sh --install      # also install Ollama via winget if missing (Windows)
#   scripts/setup-ollama.sh --run-demo     # then run run-agent --live in Docker against this Ollama (throwaway DB)
set -euo pipefail

MODEL="qwen3:1.7b"   # must match the model name in src/backend/ollama.py
HOST_URL="http://localhost:11434"
WAIT_SECONDS=60

install=false
run_demo=false
for arg in "$@"; do
  case "$arg" in
    --install) install=true ;;
    --run-demo) run_demo=true ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

log() { printf '\n==> %s\n' "$*"; }

ensure_cli() {
  command -v ollama >/dev/null 2>&1 && return
  if $install && command -v winget >/dev/null 2>&1; then
    log "Installing Ollama with winget"
    winget install -e --id Ollama.Ollama --accept-source-agreements --accept-package-agreements
    # winget updates PATH for new shells only; look in the default install folder.
    export PATH="$PATH:${LOCALAPPDATA:-}/Programs/Ollama"
    command -v ollama >/dev/null 2>&1 && return
    echo "Ollama installed but not on PATH yet. Open a new terminal and rerun this script." >&2
    exit 1
  fi
  echo "Ollama CLI not found. Install it from https://ollama.com/download or rerun with --install." >&2
  exit 1
}

server_up() { curl -fsS "$HOST_URL/api/tags" >/dev/null 2>&1; }

ensure_server() {
  server_up && return
  log "Starting 'ollama serve' in the background"
  nohup ollama serve >/dev/null 2>&1 &
  for _ in $(seq 1 "$WAIT_SECONDS"); do
    server_up && return
    sleep 1
  done
  echo "Ollama server did not answer on $HOST_URL within ${WAIT_SECONDS}s." >&2
  exit 1
}

ensure_model() {
  if ollama list | awk 'NR>1 {print $1}' | grep -qx "$MODEL"; then
    log "Model $MODEL already present"
  else
    log "Pulling $MODEL (about 1.4 GB, one time)"
    ollama pull "$MODEL"
  fi
}

warm_up() {
  # First call loads the model into RAM; the app's per-request timeout is only 20 s.
  log "Warming up $MODEL"
  curl -fsS "$HOST_URL/api/generate" \
    -d "{\"model\":\"$MODEL\",\"prompt\":\"ping\",\"stream\":false,\"think\":false,\"keep_alive\":\"30m\",\"options\":{\"num_predict\":4}}" \
    >/dev/null
  echo "Ollama is ready: $HOST_URL ($MODEL)"
}

run_demo() {
  # `replay` is always offline, so real Qwen needs `run-agent --live` on a seeded database.
  # A throwaway named volume keeps demo rows out of the real db-data volume; the be
  # entrypoint creates the schema, migrates and (SEED_DEMO) loads the demo orders.
  local volume="delivery-agent-live-demo"
  local run=(docker compose run --rm -T --no-deps -v "$volume:/data" -e SEED_DEMO=true
             -e OLLAMA_ENDPOINT=http://host.docker.internal:11434/api/generate)

  log "Building the image"
  docker compose build be

  # --live refuses historical timestamps, so decide at the current UTC time.
  log "Running run-agent --live with real Qwen"
  "${run[@]}" be run-agent --order-id 1002 \
    --as-of "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --live || true

  docker volume rm "$volume" >/dev/null
}

ensure_cli
ensure_server
ensure_model
warm_up
if $run_demo; then run_demo; fi
