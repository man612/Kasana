# Build and start this independent MoneyMatter copy using Docker Compose.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$selfHost = Join-Path $root 'self-hosting'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker is not installed or not in PATH. Install Docker Desktop with WSL 2 backend first.'
}
if (-not (Test-Path -LiteralPath (Join-Path $selfHost '.env'))) {
  throw 'Missing self-hosting/.env. Run .\scripts\setup-local-private.ps1 first.'
}

$files = @(
  '-f', 'docker-compose.yml',
  '-f', 'docker-compose.build.yml',
  '-f', 'docker-compose.private.yml'
)

Push-Location $selfHost
try {
  & docker compose @files config --quiet
  if ($LASTEXITCODE -ne 0) { throw 'Compose configuration validation failed.' }
  & docker compose @files up -d --build
  if ($LASTEXITCODE -ne 0) { throw 'Docker Compose build/start failed. Inspect docker compose logs.' }
  & docker compose @files ps
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read Docker Compose service status.' }
  Write-Host 'Open http://localhost:8080 after the frontend and backend are healthy.'
}
finally {
  Pop-Location
}
