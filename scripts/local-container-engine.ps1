# Shared, read-only runtime preflight for the local source-build scripts.
# Requires PowerShell 7.2+. Runtime storage is never migrated or cleaned here.
function Get-LocalContainerRuntime {
  param([ValidateSet('Auto', 'Podman', 'Docker')][string]$Engine = 'Auto')

  $selected = $Engine.ToLowerInvariant()
  if ($selected -eq 'auto') {
    $selected = @('podman', 'docker') | Where-Object {
      Get-Command $_ -CommandType Application -ErrorAction SilentlyContinue
    } | Select-Object -First 1
  }
  if (-not $selected) { throw 'No container CLI found on PATH. Install Podman (preferred on Windows) or Docker.' }
  $cli = Get-Command $selected -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $cli) { throw "$selected CLI not found on PATH. Install it or select another -Engine explicitly." }

  Write-Host "Container engine: $selected. Its images and volumes are separate from other engines."
  if ($selected -eq 'podman' -and $env:OS -eq 'Windows_NT') {
    $machines = & $cli.Source machine list --format json
    if ($LASTEXITCODE -ne 0) { throw 'Cannot query Podman machines. Run podman machine list.' }
    $running = @($machines | ConvertFrom-Json) | Where-Object { $_.Running -eq $true }
    if (-not $running) {
      throw 'No running Podman machine. Run podman machine list; initialize one if needed, then podman machine start <name>.'
    }
  }
  & $cli.Source info *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "$selected engine is not reachable. Start its Linux runtime and check $selected info. Auto does not switch storage after a failed preflight."
  }
  & $cli.Source compose version | Out-Host
  if ($LASTEXITCODE -ne 0) {
    throw "$selected compose is unavailable. Podman delegates to an external provider: install Docker Compose v2 on PATH, or set PODMAN_COMPOSE_PROVIDER to its executable. Docker requires the Compose plugin."
  }
  return [pscustomobject]@{ Name = $selected; Command = $cli.Source }
}

function Invoke-LocalCompose {
  param([Parameter(Mandatory)]$Runtime, [Parameter(Mandatory)][string[]]$Arguments)
  $files = @('-f', 'docker-compose.yml', '-f', 'docker-compose.build.yml', '-f', 'docker-compose.private.yml')
  & $Runtime.Command compose @files @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$($Runtime.Name) compose $($Arguments[0]) failed (exit $LASTEXITCODE)."
  }
}
