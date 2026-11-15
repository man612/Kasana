#Requires -Version 7.2
# Read-only service/HTTP smoke test; never registers users or changes data.
[CmdletBinding()]
param(
  [ValidateSet('Auto', 'Podman', 'Docker')][string]$Engine = 'Auto',
  [uri]$BaseUri = 'http://127.0.0.1:8080'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-container-engine.ps1')
$selfHost = Join-Path (Split-Path -Parent $PSScriptRoot) 'self-hosting'
if (-not (Test-Path -LiteralPath (Join-Path $selfHost '.env'))) { throw 'Missing self-hosting/.env.' }
$runtime = Get-LocalContainerRuntime -Engine $Engine
$bad = @()
Push-Location $selfHost
try {
  Invoke-LocalCompose -Runtime $runtime -Arguments @('config', '--quiet')
  Invoke-LocalCompose -Runtime $runtime -Arguments @('ps')
  foreach ($service in @('db', 'redis', 'currency-rates-api', 'backend', 'frontend')) {
    try {
      $ids = @(Invoke-LocalCompose -Runtime $runtime -Arguments @('ps', '-q', $service))
      if ($ids.Count -ne 1 -or -not $ids[0]) { throw 'Expected exactly one running container.' }
      $json = & $runtime.Command inspect $ids[0]
      if ($LASTEXITCODE -ne 0) { throw "Container inspect failed (exit $LASTEXITCODE)." }
      $container = @($json | ConvertFrom-Json)[0]
      $state = $container.State.Status
      # Docker uses Health; Podman versions can expose Healthcheck instead.
      $health = $container.State.Health.Status
      if (-not $health) { $health = $container.State.Healthcheck.Status }
      if (-not $health) { $health = 'no-healthcheck' }
      Write-Host "${service}: $state / $health"
      if ($state -ne 'running') { throw "Container is $state." }
      if ($service -eq 'frontend') {
        if ($health -notin @('healthy', 'no-healthcheck')) { throw "Health is $health." }
      }
      elseif ($health -ne 'healthy') { throw "Required healthcheck is $health." }
    }
    catch { $bad += "${service}: $($_.Exception.Message)" }
  }
}
finally { Pop-Location }
try {
  $url = $BaseUri.AbsoluteUri.TrimEnd('/') + '/sign-in'
  $response = Invoke-WebRequest -Uri $url -TimeoutSec 15 -UseBasicParsing
  Write-Host "Frontend /sign-in: HTTP $($response.StatusCode)"
  if ($response.StatusCode -ne 200) { $bad += "Frontend HTTP $($response.StatusCode)" }
}
catch { $bad += "Frontend HTTP request failed: $($_.Exception.Message)" }
if ($bad.Count) {
  $bad | ForEach-Object { Write-Warning $_ }
  throw 'FAIL: service/HTTP checks incomplete. Starting services may need more time; rerun verification. No data changed.'
}
Write-Host 'PASS: five services running; four required healthchecks healthy; frontend /sign-in HTTP 200.'
