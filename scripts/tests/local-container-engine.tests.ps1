#Requires -Version 7.2
# Dependency-free mocks: no runtime, network, credentials or real .env access.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Get-ChildItem (Join-Path $repo 'scripts') -Recurse -Filter '*.ps1' | ForEach-Object {
  $tokens = $null; $errors = $null
  $null = [System.Management.Automation.Language.Parser]::ParseFile($_.FullName, [ref]$tokens, [ref]$errors)
  if ($errors.Count) { throw ($errors | Out-String) }
}
. (Join-Path $repo 'scripts/local-container-engine.ps1')
$global:lajurTest_count = 0
function Assert-True($Value, $Message) {
  if (-not $Value) { throw "Assertion failed: $Message" }
  $global:lajurTest_count++
}
function Assert-Throws($Action, $Pattern) {
  try { & $Action } catch {
    Assert-True ($_.Exception.Message -match $Pattern) $_.Exception.Message
    return
  }
  throw "Expected failure matching: $Pattern"
}
$global:lajurTest_cli = {
  $global:lajurTest_calls += ,@($args)
  $global:LASTEXITCODE = 0
  switch ($args[0]) {
    'machine' {
      if ($global:lajurTest_failure -eq 'machine') { $global:LASTEXITCODE = 12 }
      if ($global:lajurTest_failure -eq 'stopped') { '[{"Running":false}]' } else { '[{"Running":true}]' }
    }
    'info' { if ($global:lajurTest_failure -eq 'info') { $global:LASTEXITCODE = 13 } }
    'compose' {
      if ($args[1] -eq 'version') {
        'Synthetic Compose v2'
        if ($global:lajurTest_failure -eq 'provider') { $global:LASTEXITCODE = 14 }
      }
      elseif ($args -contains 'config') {
        if ($global:lajurTest_failure -eq 'config') { $global:LASTEXITCODE = 15 }
      }
      elseif ($args -contains '-q') {
        if ($global:lajurTest_failure -eq 'ps') { $global:LASTEXITCODE = 16 }
        elseif ($global:lajurTest_failure -ne 'missing') { $args[-1] }
      }
      elseif ($args -contains 'up' -and $global:lajurTest_failure -eq 'up') { $global:LASTEXITCODE = 19 }
      elseif ($global:lajurTest_failure -eq 'status') { $global:LASTEXITCODE = 17 }
    }
    'inspect' {
      if ($global:lajurTest_failure -eq 'inspect') { $global:LASTEXITCODE = 18; return }
      $health = if ($global:lajurTest_failure -eq 'unhealthy') { 'unhealthy' } else { 'healthy' }
      $state = @{ Status = 'running' }
      if ($global:lajurTest_failure -eq 'exited') { $state.Status = 'exited' }
      if ($args[1] -ne 'frontend' -and $global:lajurTest_failure -ne 'no-health') {
        $key = if ($global:lajurTest_podmanHealth) { 'Healthcheck' } else { 'Health' }
        $state[$key] = @{ Status = $health }
      }
      ConvertTo-Json -Depth 5 -InputObject @(@{ State = $state }) -Compress
    }
    default { throw "Unexpected native command: $args" }
  }
}
function Get-Command {
  param($Name, $CommandType, $ErrorAction)
  if ($Name -in $global:lajurTest_available) { [pscustomobject]@{ Source = $global:lajurTest_cli } }
}
function Invoke-WebRequest {
  param($Uri, $TimeoutSec, [switch]$UseBasicParsing)
  if ($global:lajurTest_failure -eq 'http') { throw 'Synthetic HTTP failure' }
  [pscustomobject]@{ StatusCode = 200 }
}
$originalOS = $env:OS
$temp = Join-Path ([IO.Path]::GetTempPath()) ('lajur-script-tests-' + [guid]::NewGuid())
try {
  $env:OS = 'Windows_NT'
  $global:lajurTest_available = @('podman', 'docker')
  $global:lajurTest_calls = @(); $global:lajurTest_failure = ''; $global:lajurTest_podmanHealth = $false
  $runtime = Get-LocalContainerRuntime
  Assert-True ($runtime.Name -eq 'podman' -and @($runtime).Count -eq 1) 'Auto prefers Podman; native version output must not pollute return value'
  Assert-True ((Get-LocalContainerRuntime -Engine Docker).Name -eq 'docker') 'Explicit Docker'
  $global:lajurTest_available = @('docker')
  Assert-True ((Get-LocalContainerRuntime).Name -eq 'docker') 'Docker-only automatic detection'
  Assert-Throws { Get-LocalContainerRuntime -Engine Podman } 'not found'
  $global:lajurTest_available = @()
  Assert-Throws { Get-LocalContainerRuntime } 'No container CLI'
  $global:lajurTest_available = @('podman', 'docker')
  foreach ($failure in @('machine', 'stopped', 'info', 'provider')) {
    $global:lajurTest_failure = $failure
    Assert-Throws { Get-LocalContainerRuntime } 'machine|reachable|unavailable'
  }
  $global:lajurTest_failure = ''; $global:lajurTest_calls = @()
  $env:OS = 'Linux'
  $runtime = Get-LocalContainerRuntime -Engine Podman
  Assert-True (@($global:lajurTest_calls | Where-Object { $_[0] -eq 'machine' }).Count -eq 0) 'Native Linux Podman needs no machine'
  $global:lajurTest_failure = 'config'
  Assert-Throws { Invoke-LocalCompose -Runtime $runtime -Arguments @('config', '--quiet') } 'exit 15'
  $global:lajurTest_failure = ''

  # Copy only scripts to an isolated synthetic tree. Never invoke setup on the checkout.
  New-Item -ItemType Directory -Path (Join-Path $temp 'scripts'), (Join-Path $temp 'self-hosting') | Out-Null
  Copy-Item (Join-Path $repo 'scripts/*local*.ps1') (Join-Path $temp 'scripts')
  Set-Content (Join-Path $temp 'self-hosting/.env') '# synthetic test marker'
  $run = Join-Path $temp 'scripts/run-local-private.ps1'
  $verify = Join-Path $temp 'scripts/verify-local-private.ps1'
  $setup = Join-Path $temp 'scripts/setup-local-private.ps1'
  $global:lajurTest_calls = @()
  & $run -Engine Podman -ValidateOnly
  Assert-True (@($global:lajurTest_calls | Where-Object { $_ -contains 'up' }).Count -eq 0) 'ValidateOnly never starts services'
  Assert-Throws { & $setup } 'already exists'
  Assert-True ((Get-Content (Join-Path $temp 'self-hosting/.env')) -eq '# synthetic test marker') 'Existing credentials preserved'
  foreach ($failure in @('config', 'status', 'ps', 'missing', 'inspect', 'unhealthy', 'exited', 'no-health', 'http')) {
    $global:lajurTest_failure = $failure
    Assert-Throws { & $verify -Engine Podman } 'failed|FAIL'
  }
  $global:lajurTest_failure = 'config'; $global:lajurTest_calls = @()
  Assert-Throws { & $run -Engine Podman } 'exit 15'
  Assert-True (@($global:lajurTest_calls | Where-Object { $_ -contains 'up' }).Count -eq 0) 'Invalid configuration stops startup'
  $global:lajurTest_failure = 'up'
  Assert-Throws { & $run -Engine Podman } 'exit 19'
  $global:lajurTest_failure = ''; $global:lajurTest_calls = @()
  & $verify -Engine Docker
  $global:lajurTest_podmanHealth = $true
  & $verify -Engine Podman -BaseUri 'http://127.0.0.1:8082'
  Assert-True (@($global:lajurTest_calls | Where-Object { $_ -contains 'up' -or $_ -contains 'down' }).Count -eq 0) 'Verification is read-only'
  # Generate fresh secrets only in the temporary synthetic tree.
  Remove-Item -Force (Join-Path $temp 'self-hosting/.env')
  Copy-Item (Join-Path $repo 'self-hosting/.env.example') (Join-Path $temp 'self-hosting/.env.example')
  & $setup
  $generated = Get-Content (Join-Path $temp 'self-hosting/.env') -Raw
  Assert-True ($generated -notmatch '(?m)^[A-Z0-9_]+=__REPLACE_ME__\r?$') 'All secret placeholders filled'
  Assert-True ($generated -match '(?m)^HTTP_PORT=127.0.0.1:8080\r?$') 'Loopback-only default'
  $secretMatches = [regex]::Matches($generated, '(?m)^(APPLICATION_JWT_SECRET|APP_SESSION_ID_SECRET|BETTER_AUTH_SECRET|APPLICATION_DB_PASSWORD)=([a-f0-9]{48,64})\r?$')
  Assert-True ($secretMatches.Count -eq 4) 'Four cryptographic secrets generated'
  Assert-True (@($secretMatches | ForEach-Object { $_.Groups[2].Value } | Select-Object -Unique).Count -eq 4) 'Secrets are independent'
  Assert-Throws { & $setup } 'already exists'
  Write-Host "PASS: $global:lajurTest_count mocked assertions; Docker/Podman health paths passed."
}
finally {
  $env:OS = $originalOS
  Remove-Item Function:Get-Command, Function:Invoke-WebRequest
  if (Test-Path $temp) { Remove-Item -LiteralPath $temp -Recurse -Force }
}
