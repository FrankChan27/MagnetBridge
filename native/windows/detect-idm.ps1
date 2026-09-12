$ErrorActionPreference = "SilentlyContinue"
$paths = @(
  "${env:ProgramFiles(x86)}\Internet Download Manager\IDMan.exe",
  "$env:ProgramFiles\Internet Download Manager\IDMan.exe"
)
$found = $null
foreach ($p in $paths) { if (Test-Path $p) { $found = $p; break } }
if ($found) {
  Write-Output "FOUND $found"
  Write-Output "ACTION ignore"
  Write-Output "VERDICT REJECTED"
} else {
  Write-Output "NOT_FOUND"
  Write-Output "FALLBACK webseed+webtorrent"
}
