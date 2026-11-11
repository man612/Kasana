#!/bin/sh
# Fail-closed self-hosting smoke: ensure the production image contains ONLY
# Kasana's frontend, starts with no MCP endpoint, and does not serve the old
# marketing site or redirect confidential support to an unrelated service.
set -eu

IMAGE="$1"
PORT="${PORT:-8089}"
BASE="http://localhost:$PORT"
cid=$(docker run -d -p "$PORT:80" \
  -e IS_SELF_HOST=true -e SKIP_LANDING=false -e MCP_BASE_URL= "$IMAGE")
trap 'docker rm -f "$cid" >/dev/null' EXIT
i=0
until curl -fsS -o /dev/null "$BASE/version.json"; do
  i=$((i + 1))
  [ "$i" -lt 30 ] || { echo "Frontend container did not start" >&2; docker logs "$cid" >&2; exit 1; }
  sleep 1
done
code() { curl -sS -o /dev/null -w '%{http_code}' "$BASE$1"; }
redirect() { curl -sS -o /dev/null -D - "$BASE$1" | tr -d '\r' | grep -i '^location:'; }
[ "$(code /dashboard)" = "200" ] || { echo "FAIL dashboard" >&2; exit 1; }
[ "$(code /)" = "302" ] || { echo "FAIL root redirect" >&2; exit 1; }
redirect / | grep -q '/dashboard' || { echo "FAIL root target" >&2; exit 1; }
[ "$(code /privacy-policy)" = "302" ] || { echo "FAIL privacy notice link" >&2; exit 1; }
[ "$(code /terms-of-use)" = "302" ] || { echo "FAIL terms notice link" >&2; exit 1; }
[ "$(code /operator-notice.html)" = "200" ] || { echo "FAIL operator notice" >&2; exit 1; }
[ "$(code /sitemap-index.xml)" = "404" ] || { echo "FAIL upstream sitemap still served" >&2; exit 1; }
[ "$(code /_astro/fake.css)" = "404" ] || { echo "FAIL upstream Astro assets" >&2; exit 1; }
[ "$(code /.well-known/mcp/server-card.json)" = "404" ] || { echo "FAIL unconfigured MCP discovery" >&2; exit 1; }
[ "$(code /.well-known/oauth-authorization-server)" = "404" ] || { echo "FAIL unconfigured OAuth discovery" >&2; exit 1; }
docker exec "$cid" sh -c 'test ! -e /landing/index.html' || { echo "FAIL inherited landing exists" >&2; exit 1; }
curl -fsS "$BASE/.well-known/security.txt" | grep -q 'github.com/man612/Kasana' || { echo "FAIL Kasana security contact" >&2; exit 1; }
echo "Kasana self-hosted frontend isolation smoke test passed"
