#!/usr/bin/env bash
# CI-ONLY browser smoke. Refuse to launch a stack on an operator workstation.
set -Eeuo pipefail
if [ "${RUNNER_ENVIRONMENT:-}" != "github-hosted" ] || [ "$GITHUB_ACTIONS" != "true" ]; then
  echo "Refusing to start the browser smoke stack outside GitHub Actions" >&2
  exit 1
fi
repo="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$repo/self-hosting"
if [ -e .env ] || [ -e stack.env ]; then
  echo "Refusing to overwrite any existing server configuration" >&2
  exit 1
fi
cp .env.example .env
for key in APPLICATION_JWT_SECRET APP_SESSION_ID_SECRET BETTER_AUTH_SECRET APPLICATION_DB_PASSWORD; do
  value="$(openssl rand -hex 32)"
  sed -i "s/^$key=__REPLACE_ME__/$key=$value/" .env
done
# This is a freshly-created, disposable UI smoke stack. The browser suite
# seeds many distinct users within seconds; Better Auth's production sign-up
# limiter would reject that synthetic traffic without testing UI behavior.
# Dedicated backend E2E tests continue to exercise auth/rate-limit security.
# Never set this flag in a public or operator-owned deployment.
printf '\nDISABLE_AUTH_RATE_LIMIT=true\n' >> .env
compose() {
  docker compose -p kasana-browser-ci -f docker-compose.yml -f docker-compose.build.yml -f docker-compose.private.yml "$@"
}
cleanup() {
  local status="$?"
  cd "$repo/self-hosting"
  if [ "$status" -ne 0 ]; then
    echo "Synthetic browser smoke failed: disposable container status"
    compose ps || true
    compose logs --tail=35 backend frontend db redis currency-rates-api || true
  fi
  compose down --volumes --remove-orphans || true
  rm -f .env
}
trap cleanup EXIT
export NODE_BUILD_HEAP_MB=4096
compose build backend
compose build frontend
compose up -d --no-build --wait --wait-timeout 300
curl --fail --silent http://localhost:8080/version.json >/dev/null
echo "Disposable Kasana frontend/backend/Postgres/Redis/rates stack is healthy"
cd "$repo"
npm ci
npx playwright install --with-deps chromium
export PLAYWRIGHT_BASE_URL=http://localhost:8080
export PLAYWRIGHT_API_BASE_URL=http://localhost:8080
npx playwright test --config packages/frontend/playwright.config.ts \
  packages/frontend/e2e/tests/kasana --project chromium --workers=1 --retries=0
