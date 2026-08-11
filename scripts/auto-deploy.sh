#!/usr/bin/env bash
set -Eeuo pipefail

readonly APP_DIR="${GAMES_APP_DIR:-/DATA/AppData/games-platform}"
readonly BRANCH="${GAMES_DEPLOY_BRANCH:-main}"
readonly LOCK_FILE="${GAMES_DEPLOY_LOCK:-/tmp/games-platform-autodeploy.lock}"

log() {
  printf '[games-autodeploy] %s\n' "$*"
}

healthcheck() {
  local container_id health
  container_id="$(docker compose ps -q games)"
  if [[ -z "$container_id" ]]; then
    log 'The games container was not created.'
    return 1
  fi

  for _ in {1..60}; do
    health="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_id" 2>/dev/null || true)"
    case "$health" in
      healthy|running)
        log "Container is $health."
        return 0
        ;;
      unhealthy|exited|dead)
        log "Container entered state: $health"
        return 1
        ;;
    esac
    sleep 2
  done

  log 'Container did not become healthy before the timeout.'
  return 1
}

deploy_current_checkout() {
  local revision
  revision="$(git rev-parse HEAD)"
  APP_REVISION="$revision" docker compose up -d --build
  healthcheck
}

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log 'Another deployment is already running.'
  exit 0
fi

cd "$APP_DIR"
if [[ ! -d .git ]]; then
  log "No Git checkout found at $APP_DIR. Run scripts/install-autodeploy.sh first."
  exit 1
fi

if [[ ! -f .env ]]; then
  log 'Refusing to deploy because the production .env file is missing.'
  exit 1
fi

previous_revision="$(git rev-parse HEAD)"
git fetch --quiet --depth=1 origin "$BRANCH"
target_revision="$(git rev-parse FETCH_HEAD)"

if [[ "$previous_revision" == "$target_revision" ]]; then
  log "Already current at ${target_revision:0:7}."
  exit 0
fi

log "Deploying ${target_revision:0:7} from origin/$BRANCH."
git reset --hard "$target_revision"

if deploy_current_checkout; then
  log "Deployment ${target_revision:0:7} completed successfully."
  exit 0
fi

log "Deployment failed; rolling back to ${previous_revision:0:7}."
git reset --hard "$previous_revision"
if deploy_current_checkout; then
  log 'Rollback completed successfully. The failed release will be retried later.'
else
  log 'Rollback also failed. Manual intervention is required.'
fi
exit 1
