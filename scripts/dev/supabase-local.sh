#!/usr/bin/env bash
# Local Supabase stack (Postgres, Auth, Realtime, Storage, Edge Functions, test inbox).
#
# On a normal computer with Docker Desktop:  npm run db:start
# In sandboxes that cannot reach the default registry, set
#   VT_DOCKER_MIRROR=mirror.gcr.io
# and the script pulls images through the mirror (Docker Hub names differ for
# a few images, so they are pulled under their Hub name and re-tagged).
set -euo pipefail

cmd="${1:-start}"
cd "$(dirname "$0")/../.."
EXCLUDE="studio,logflare,vector,imgproxy,supavisor,postgres-meta"

ensure_docker() {
  if docker info >/dev/null 2>&1; then return; fi
  if command -v dockerd >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
    (dockerd >/tmp/dockerd.log 2>&1 &)
    for _ in $(seq 1 30); do docker info >/dev/null 2>&1 && return; sleep 1; done
  fi
  echo "Docker is not running. Start Docker Desktop and try again." >&2
  exit 1
}

hub_name() {
  case "$1" in
    supabase/kong:*) echo "library/kong:${1#*:}" ;;
    supabase/mailpit:*) echo "axllent/mailpit:${1#*:}" ;;
    supabase/postgrest:*) echo "postgrest/postgrest:${1#*:}" ;;
    *) echo "$1" ;;
  esac
}

start() {
  ensure_docker
  if [ -z "${VT_DOCKER_MIRROR:-}" ]; then
    npx supabase start -x "$EXCLUDE"
    return
  fi
  export SUPABASE_INTERNAL_IMAGE_REGISTRY="$VT_DOCKER_MIRROR"
  for attempt in 1 2 3; do
    if output=$(npx supabase start -x "$EXCLUDE" 2>&1); then
      echo "$output" | tail -20
      return
    fi
    missing=$(echo "$output" | grep -oE "${VT_DOCKER_MIRROR}/supabase/[a-z-]+:[A-Za-z0-9._-]+" | sort -u || true)
    if [ -z "$missing" ]; then echo "$output" >&2; exit 1; fi
    for ref in $missing; do
      short="${ref#"$VT_DOCKER_MIRROR"/}"
      hub="$(hub_name "$short")"
      echo "pulling $hub for $short (attempt $attempt)"
      docker pull -q "$VT_DOCKER_MIRROR/$hub" >/dev/null
      docker tag "$VT_DOCKER_MIRROR/$hub" "$ref"
    done
  done
  echo "Could not start Supabase" >&2
  exit 1
}

case "$cmd" in
  start) start ;;
  stop) npx supabase stop ;;
  reset) npx supabase db reset ;;
  status) npx supabase status ;;
  *) echo "usage: $0 start|stop|reset|status" >&2; exit 2 ;;
esac
