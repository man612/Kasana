#!/usr/bin/env bash
# Lajur. — optional local commands for a disposable InstaBox trial only.
# This wrapper always includes the source-build, private and InstaBox isolation overlays.
# It never changes the host Docker daemon and intentionally has no prune/down/delete command.
set -euo pipefail
cd "$(dirname "$0")"

compose() {
  docker compose \
    -f docker-compose.yml \
    -f docker-compose.build.yml \
    -f docker-compose.private.yml \
    -f docker-compose.instabox.yml \
    "$@"
}

require_env() {
  if [ ! -f .env ]; then
    echo 'ERROR: self-hosting/.env missing; copy .env.example and configure locally.' >&2
    exit 1
  fi
  if grep -Eq '^[A-Z_][A-Z0-9_]*=__REPLACE_ME__' .env; then
    echo 'ERROR: .env contains placeholder secrets. Generate unique local secrets first.' >&2
    exit 1
  fi
}

case "${1:-}" in
  check)
    require_env
    compose config --quiet
    echo 'Compose configuration parses successfully; check service images, domain, ports and mounts separately.'
    ;;
  build-backend)
    require_env
    compose build backend
    ;;
  build-frontend)
    require_env
    compose build frontend
    ;;
  up)
    require_env
    # A transient HTTPS preview still needs real auth origins. Never default
    # to localhost, which would break sign-in on mobile and proxy callbacks.
    if ! grep -Eq '^AUTH_ORIGIN=https://[^[:space:]]+$' .env ||
       ! grep -Eq '^BETTER_AUTH_URL=https://[^[:space:]]+$' .env; then
      echo 'ERROR: set AUTH_ORIGIN and BETTER_AUTH_URL to your InstaBox private HTTPS preview origin.' >&2
      exit 1
    fi
    if ! grep -Eq '^SYSTEM_MAX_SIGNUPS_ALLOWED=(0|1|2)
    compose up -d --no-build
    ;;
  status)
    compose ps
    ;;
  logs)
    compose logs --tail=80 backend frontend db redis currency-rates-api
    ;;
  stop)
    compose stop
    ;;
  *)
    echo 'Usage: bash self-hosting/instabox-trial.sh {check|build-backend|build-frontend|up|status|logs|stop}' >&2
    echo 'First check available root disk, Docker daemon and free space with scripts/check-instabox-preview.sh.' >&2
    exit 2
    ;;
esac
 .env; then
      echo 'ERROR: private trial must explicitly cap signups at 0, 1 or 2.' >&2
      exit 1
    fi
    preview_origin=$(sed -n 's/^AUTH_ORIGIN=//p' .env | tail -1)
    auth_url=$(sed -n 's/^BETTER_AUTH_URL=//p' .env | tail -1)
    if [ "$preview_origin" != "$auth_url" ]; then
      echo 'ERROR: AUTH_ORIGIN and BETTER_AUTH_URL must match exactly.' >&2
      exit 1
    fi
    compose up -d --no-build
    ;;
  status)
    compose ps
    ;;
  logs)
    compose logs --tail=80 backend frontend db redis currency-rates-api
    ;;
  stop)
    compose stop
    ;;
  *)
    echo 'Usage: bash self-hosting/instabox-trial.sh {check|build-backend|build-frontend|up|status|logs|stop}' >&2
    echo 'First check available root disk, Docker daemon and free space with scripts/check-instabox-preview.sh.' >&2
    exit 2
    ;;
esac
