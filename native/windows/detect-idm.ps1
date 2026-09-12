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
  Write-Output "ACTION ignore"
  Write-Output "VERDICT REJECTED — IDM is not part of the MagnetBridge download path"
} else {
  Write-Output "NOT_FOUND"
  Write-Output "FALLBACK webseed+webtorrent"
}
