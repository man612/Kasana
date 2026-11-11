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
cid_mcp=""
cleanup() {
  [ -z "$cid_mcp" ] || docker rm -f "$cid_mcp" >/dev/null 2>&1 || :
  docker rm -f "$cid" >/dev/null 2>&1 || :
}
trap cleanup EXIT
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
# Test the optional, explicitly configured MCP path as a second isolated
# container, without relying on a real backend, OAuth provider, or live account.
MCP_PORT="${MCP_PORT:-8090}"
MCP_BASE="http://localhost:$MCP_PORT"
cid_mcp=$(docker run -d -p "$MCP_PORT:80" \
  -e IS_SELF_HOST=true -e MCP_BASE_URL="$MCP_BASE" "$IMAGE")
i=0
until curl -fsS -o /dev/null "$MCP_BASE/version.json"; do
  i=$((i + 1))
  [ "$i" -lt 30 ] || { echo "Configured MCP frontend did not start" >&2; docker logs "$cid_mcp" >&2; exit 1; }
  sleep 1
done
curl -fsS "$MCP_BASE/.well-known/oauth-authorization-server" | grep -q "$MCP_BASE/api/v1/auth" \
  || { echo "FAIL OAuth discovery not rewritten to Kasana origin" >&2; exit 1; }
curl -fsS "$MCP_BASE/.well-known/oauth-protected-resource" | grep -q "$MCP_BASE/mcp" \
  || { echo "FAIL OAuth resource metadata not rewritten" >&2; exit 1; }
curl -fsS "$MCP_BASE/.well-known/mcp/server-card.json" | grep -q "$MCP_BASE/mcp" \
  || { echo "FAIL MCP server card not rewritten" >&2; exit 1; }

# Unsafe values must fail early, before being interpolated into sed and JSON.
if docker run --rm -e IS_SELF_HOST=true -e MCP_BASE_URL='http://bad|url' "$IMAGE" true >/dev/null 2>&1; then
  echo "FAIL invalid MCP_BASE_URL was accepted" >&2
  exit 1
fi
source_label=$(docker image inspect "$IMAGE" --format '{{ index .Config.Labels "org.opencontainers.image.source" }}')
[ "$source_label" = 'https://github.com/man612/Kasana' ] \
  || { echo "FAIL Docker source label is not Kasana" >&2; exit 1; }
echo "Kasana self-hosted frontend isolation and MCP smoke tests passed"
