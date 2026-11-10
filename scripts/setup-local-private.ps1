# Generate a localhost-only MoneyMatter environment. Existing secrets are never overwritten.
# Run from any PowerShell working directory: .\scripts\setup-local-private.ps1
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'self-hosting\.env.example'
$target = Join-Path $root 'self-hosting\.env'

if (Test-Path -LiteralPath $target) {
  throw "The environment file already exists: $target. Refusing to overwrite passwords and signing keys."
}
if (-not (Test-Path -LiteralPath $source)) {
  throw "Missing original environment template: $source"
}

function New-HexSecret([int]$bytes) {
  return [Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes($bytes)).ToLowerInvariant()
}

$contents = [System.IO.File]::ReadAllText($source)
$required = @{
  'APPLICATION_JWT_SECRET' = New-HexSecret 32
  'APP_SESSION_ID_SECRET' = New-HexSecret 32
  'BETTER_AUTH_SECRET' = New-HexSecret 32
  'APPLICATION_DB_PASSWORD' = New-HexSecret 24
}

foreach ($key in $required.Keys) {
  $pattern = '(?m)^' + [regex]::Escape($key) + '=__REPLACE_ME__\r?$'
  if ([regex]::Matches($contents, $pattern).Count -ne 1) {
    throw "Expected exactly one placeholder for $key in .env.example; no file created."
  }
  $contents = [regex]::Replace(
    $contents, $pattern,
    [System.Text.RegularExpressions.MatchEvaluator]{ param($match) ($key + '=' + $required[$key]) }
  )
}

$contents = $contents.Replace('# HTTP_PORT=8080', 'HTTP_PORT=127.0.0.1:8080')
$contents = $contents.Replace('# SYSTEM_MAX_SIGNUPS_ALLOWED=1', 'SYSTEM_MAX_SIGNUPS_ALLOWED=1')
$contents += "`n# Limit Docker source-build Node heap on a ~12 GB development machine.`nNODE_BUILD_HEAP_MB=4096`n"

[System.IO.File]::WriteAllText($target, $contents, [System.Text.UTF8Encoding]::new($false))
Write-Host 'Created self-hosting/.env with unique random secrets (not printed, excluded from git).'
Write-Host 'Local URL: http://localhost:8080'
Write-Host 'Next: install/start Docker Desktop, then .\scripts\run-local-private.ps1'
