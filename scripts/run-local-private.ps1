#Requires -Version 7.2
# Build and start Lajur. from source. -ValidateOnly performs read-only checks.
[CmdletBinding()]
param(
  [ValidateSet('Auto', 'Podman', 'Docker')][string]$Engine = 'Auto',
  [switch]$ValidateOnly
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'local-container-engine.ps1')
$selfHost = Join-Path (Split-Path -Parent $PSScriptRoot) 'self-hosting'
if (-not (Test-Path -LiteralPath (Join-Path $selfHost '.env'))) {
  throw 'Missing self-hosting/.env. For a fresh installation, run .\scripts\setup-local-private.ps1.'
}
$runtime = Get-LocalContainerRuntime -Engine $Engine
Push-Location $selfHost
try {
  Invoke-LocalCompose -Runtime $runtime -Arguments @('config', '--quiet')
  if ($ValidateOnly) {
    Write-Host 'PASS: runtime, Compose provider and configuration validated. No containers changed.'
    return
  }
  Invoke-LocalCompose -Runtime $runtime -Arguments @('up', '-d', '--build')
  Invoke-LocalCompose -Runtime $runtime -Arguments @('ps')
  Write-Host "Run .\scripts\verify-local-private.ps1 -Engine $($runtime.Name) after startup completes."
}
finally { Pop-Location }
