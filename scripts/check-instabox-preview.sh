#!/usr/bin/env bash
# Lajur. — InstaBox read-only preflight.
# Never starts/stops containers, changes Docker daemon, reads secrets, or writes files.
# Safe to run on a shared sandbox hosting another app (e.g. Absenin).
set -u

printf '\n=== SYSTEM / RESOURCES ===\n'
uname -m
printf '\nMemory and swap:\n'
free -h || true
printf '\nFilesystems (root and InstaBox persistent /data):\n'
df -h / /data || true
printf '\nAvailable inodes:\n'
df -i / /data || true

printf '\n=== PORTS 3000 / 8080 ===\n'
if command -v ss >/dev/null 2>&1; then
  ss -lnt | awk 'NR == 1 || /:3000[[:space:]]/ || /:8080[[:space:]]/'
else
  echo 'ss unavailable; check with another local port utility'
fi

printf '\n=== DOCKER CONNECTIVITY ===\n'
if ! command -v docker >/dev/null 2>&1; then
  echo 'Docker CLI not installed. Do not proceed with Compose.'
  exit 0
fi
docker --version
docker compose version 2>&1 || true
docker buildx version 2>&1 || true

if docker info --format 'Docker storage root: {{.DockerRootDir}} (driver: {{.Driver}})' 2>/dev/null; then
  printf '\nDocker images, build cache and volumes:\n'
  docker system df 2>&1 || true
  printf '\nRunning containers (names / ports / status only):\n'
  docker ps --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}' 2>&1 || true
  printf '\nCompose projects:\n'
  docker compose ls 2>&1 || true
else
  echo 'WARNING: Docker CLI exists, but daemon is not reachable as this user.'
  echo 'Check Docker permissions; do not restart or reconfigure the shared daemon.'
fi

printf '\n=== STORAGE PATHS ===\n'
for path in /var/lib/docker /var/lib/containerd; do
  if [ -d "$path" ]; then
    printf '%s resides on: ' "$path"
    df -h "$path" | tail -1
  fi
done

printf '\nPreflight completed: READ ONLY. Review root disk, Docker storage and free space before builds.\n'
printf 'Never share .env, API keys, access tokens or private preview links.\n'
