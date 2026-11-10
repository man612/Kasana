# Build and start this independent MoneyMatter copy using Docker Compose.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$selfHost = Join-Path $root 'self-hosting'

$dockerCommand = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $dockerCommand -and (Test-Path 'F:\Applications\DockerDesktop\resources\bin\docker.exe')) {
  $dockerCommand = 'F:\Applications\DockerDesktop\resources\bin\docker.exe'
}
if (-not $dockerCommand) {
  throw 'Docker CLI not found. Install or start Docker Desktop with the WSL 2 backend.'
}
# Custom Docker Desktop installation on F: is not added to this PowerShell session's PATH.
# Compose needs docker-credential-desktop and the CLI plugins from the same directory.
$dockerBin = Split-Path -Parent $dockerCommand
if (($env:PATH -split ';') -notcontains $dockerBin) {
  $env:PATH = $dockerBin + ';' + $env:PATH
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
  & $dockerCommand compose @files config --quiet
  if ($LASTEXITCODE -ne 0) { throw 'Compose configuration validation failed.' }
  & $dockerCommand compose @files up -d --build
  if ($LASTEXITCODE -ne 0) { throw 'Docker Compose build/start failed. Inspect docker compose logs.' }
  & $dockerCommand compose @files ps
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read Docker Compose service status.' }
  Write-Host 'Open http://localhost:8080 after the frontend and backend are healthy.'
}
finally {
  Pop-Location
}
