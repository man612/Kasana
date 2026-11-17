#!/usr/bin/env bash
# Lajur. — optional local commands for a disposable InstaBox trial only.
# Always includes source-build, private and InstaBox isolation overlays.
# Never changes the host Docker daemon and has no prune/down/delete command.
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
    echo 'ERROR: self-hosting/.env missing. Run the init command first.' >&2
    exit 1
  fi
  if grep -Eq '^[A-Z_][A-Z0-9_]*=__REPLACE_ME__' .env; then
    echo 'ERROR: .env contains placeholder secrets. Generate unique local secrets first.' >&2
    exit 1
  fi
}

case "${1:-}" in
  init)
    python3 ../scripts/init-instabox-preview-env.py
    ;;
  check)
    require_env
    compose config --quiet
    echo 'Compose configuration parses; review images, names, ports and mounts before launch.'
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
    # The public-facing origin is HTTPS, even though the local service uses HTTP.
    if ! grep -Eq '^AUTH_ORIGIN=https://[^[:space:]]+$' .env ||
       ! grep -Eq '^BETTER_AUTH_URL=https://[^[:space:]]+$' .env; then
      echo 'ERROR: configure HTTPS AUTH_ORIGIN and BETTER_AUTH_URL first.' >&2
      exit 1
    fi
    if ! grep -Eq '^SYSTEM_MAX_SIGNUPS_ALLOWED=(0|1|2)$' .env; then
      echo 'ERROR: trial signups must be explicitly limited to 0, 1 or 2.' >&2
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
  cap)
    require_env
    case "${2:-}" in
      0|1|2) ;;
      *) echo 'ERROR: choose signup cap 0, 1 or 2.' >&2; exit 2 ;;
    esac
    if ! grep -Eq '^SYSTEM_MAX_SIGNUPS_ALLOWED=(0|1|2)$' .env; then
      echo 'ERROR: expected a local capped trial configuration.' >&2
      exit 1
    fi
    sed -i -E "s/^SYSTEM_MAX_SIGNUPS_ALLOWED=(0|1|2)$/SYSTEM_MAX_SIGNUPS_ALLOWED=$2/" .env
    if [ -n "$(compose ps -q backend)" ]; then
      compose up -d --no-build backend
    fi
    echo "Trial signup cap set to $2. No other app was changed."
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
    echo 'Usage: bash self-hosting/instabox-trial.sh {init|check|build-backend|build-frontend|up|cap|status|logs|stop}' >&2
    echo 'First run scripts/check-instabox-preview.sh to inspect Docker and root disk.' >&2
    exit 2
    ;;
esac
