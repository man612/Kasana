# Safe smoke-test: reads Docker/HTTP health without changing database or creating a user.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$selfHost = Join-Path $root 'self-hosting'
$docker = (Get-Command docker -ErrorAction SilentlyContinue).Source
if (-not $docker -and (Test-Path 'F:\Applications\DockerDesktop\resources\bin\docker.exe')) {
  $docker = 'F:\Applications\DockerDesktop\resources\bin\docker.exe'
}
if (-not $docker) { throw 'Docker CLI not found.' }
$dockerBin = Split-Path -Parent $docker
$env:PATH = $dockerBin + ';' + $env:PATH

$compose = @('-f','docker-compose.yml','-f','docker-compose.build.yml','-f','docker-compose.private.yml')
$services = @('db','redis','currency-rates-api','backend','frontend')
$bad = @()

Push-Location $selfHost
try {
  & $docker compose @compose ps
  foreach ($service in $services) {
    $containerId = (& $docker compose @compose ps -q $service)
    if ($LASTEXITCODE -ne 0 -or -not $containerId) {
      $bad += "${service}: missing container"
      continue
    }
    $state = & $docker inspect --format '{{.State.Status}}' $containerId
    $health = & $docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' $containerId
    Write-Host "$service : $state / $health"
    if ($state -ne 'running' -or ($health -ne 'healthy' -and $health -ne 'no-healthcheck')) {
      $bad += "${service}: $state / $health"
    }
  }
}
finally {
  Pop-Location
}

try {
  $response = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/sign-in' -TimeoutSec 15 -UseBasicParsing
  Write-Host "Frontend /sign-in: HTTP $($response.StatusCode)"
  if ($response.StatusCode -ne 200) { $bad += "frontend HTTP $($response.StatusCode)" }
}
catch {
  $bad += "Frontend HTTP request failed: $($_.Exception.Message)"
}

if ($bad.Count) {
  $bad | ForEach-Object { Write-Warning $_ }
  throw 'Smoke test incomplete/failed. No data was changed.'
}
Write-Host 'PASS: Five services healthy and sign-in page responds with HTTP 200.'
Write-Host 'Next: register your first account and verify IDR + Bahasa Indonesia in browser.'
