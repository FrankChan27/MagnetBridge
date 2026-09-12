$ErrorActionPreference = "SilentlyContinue"
$paths = @(
  "${env:ProgramFiles(x86)}\Internet Download Manager\IDMan.exe",
  "$env:ProgramFiles\Internet Download Manager\IDMan.exe"
)
$found = $null
foreach ($p in $paths) {
  if (Test-Path $p) { $found = $p; break }
}
if (-not $found) {
  $reg = Get-ItemProperty "HKCU:\Software\DownloadManager" -Name ExePath -ErrorAction SilentlyContinue
  if ($reg -and (Test-Path $reg.ExePath)) { $found = $reg.ExePath }
}
if ($found) {
  Write-Output "FOUND $found"
  Write-Output "Q1_ACCELERATOR REJECTED"
  Write-Output "Q2_FRONTEND PARTIAL — opt-in with --idm or native\windows\test-idm-bridge.cmd"
} else {
  Write-Output "NOT_FOUND"
  Write-Output "FALLBACK architecture A (webseed+webtorrent)"
}
