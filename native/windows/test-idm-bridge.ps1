$ErrorActionPreference = "Stop"
$Root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$Out = Join-Path $env:USERPROFILE "Downloads\MagnetBridge-idm-test"
$Report = Join-Path $Root "docs\architecture-d-windows-result.json"

Write-Output "MagnetBridge Architecture D — Windows IDM frontend test"
Write-Output "This uses the official IDM CLI only: idman /n /d URL /p path /f name"
Write-Output "It will NOT pretent a simulated client is a real IDM PASS."
Write-Output ""

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  Write-Output "NODE_MISSING"
  exit 1
}
Write-Output ("NODE " + (node -v))

$idm = $null
foreach ($p in @(
    "${env:ProgramFiles(x86)}\Internet Download Manager\IDMan.exe",
    "$env:ProgramFiles\Internet Download Manager\IDMan.exe"
  )) {
  if (Test-Path $p) { $idm = $p; break }
}
if (-not $idm) {
  $reg = Get-ItemProperty "HKCU:\Software\DownloadManager" -Name ExePath -ErrorAction SilentlyContinue
  if ($reg -and (Test-Path $reg.ExePath)) { $idm = $reg.ExePath }
}

if ($idm) {
  Write-Output "IDM_FOUND $idm"
  $mode = "--idm"
} else {
  Write-Output "IDM_NOT_FOUND"
  Write-Output "Will still run SIMULATED_IDM_CLIENT so the Range bridge is exercised."
  Write-Output "That is NOT a real IDM PASS."
  $mode = "--simulate"
}

New-Item -ItemType Directory -Force -Path $Out | Out-Null
$bridge = Join-Path $Root "scripts\idm-frontend-bridge.ts"
Write-Output "Starting demand-driven localhost Range bridge on 127.0.0.1 only..."
Write-Output "Legal test file: MagnetBridge probe (CC0, ~48 KB)"
& node --experimental-strip-types $bridge $mode --fixture probe --out $Out --report $Report
$code = $LASTEXITCODE
Write-Output ""
Write-Output "Report: $Report"
Write-Output "Output folder: $Out"
if ($idm) {
  Write-Output "Look at the IDM window. The task should appear without you pasting a URL."
  Write-Output "After IDM finishes, open the report JSON and check sha256."
} else {
  Write-Output "Install/repair IDM, then run this file again for the real E2E."
}
exit $code
