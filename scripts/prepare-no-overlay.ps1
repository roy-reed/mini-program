param(
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$libraryPath = Join-Path $root 'assets-src\library.json'

if (-not (Test-Path -LiteralPath $libraryPath -PathType Leaf)) {
  throw "Library file not found: $libraryPath"
}

$library = Get-Content -LiteralPath $libraryPath -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $library.overlays) {
  throw 'library.json is missing the overlays object'
}

$videos = @($library.videos | Where-Object { $_.enabled -eq $true })
$audios = @($library.audios | Where-Object { $_.enabled -eq $true })
if ($videos.Count -ne 4 -or $audios.Count -ne 4) {
  throw "Expected the local four-background, four-audio library; found $($videos.Count) videos and $($audios.Count) audios. Do not overwrite your local library with the GitHub template."
}

$previousVersion = [int]$library.version
$previousLabel = $library.overlays.aiLabel
if ($previousVersion -lt 1) { throw 'Library version must be at least 1' }
$nextVersion = if ($null -ne $previousLabel -or $previousVersion -eq 1) { $previousVersion + 1 } else { $previousVersion }
if ($previousVersion -eq 1) { $nextVersion = 2 }

Write-Host "Original version: v$previousVersion"
Write-Host "Output version: v$nextVersion"
Write-Host "AI label: $previousLabel -> (disabled)"
Write-Host "Local media: $($videos.Count) backgrounds x $($audios.Count) tracks"
if ($CheckOnly) { Write-Host 'CheckOnly: no files changed'; exit 0 }

$backupPath = "$libraryPath.bak-no-overlay-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
Copy-Item -LiteralPath $libraryPath -Destination $backupPath
$library.overlays.aiLabel = $null
$library.version = $nextVersion
$json = $library | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($libraryPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Host "Backed up: $backupPath"

Push-Location $root
try {
  & npm run assets -- check
  if ($LASTEXITCODE -ne 0) { throw 'assets check failed; restore library from the backup if needed' }
  & npm run assets -- normalize
  if ($LASTEXITCODE -ne 0) { throw 'assets normalize failed' }
  & npm run assets -- render
  if ($LASTEXITCODE -ne 0) { throw 'assets render failed' }

  $outputRoot = Join-Path $root "dist-assets\v$nextVersion"
  $mp4Files = @(Get-ChildItem -LiteralPath (Join-Path $outputRoot 'combos') -File -Filter '*.mp4')
  $jpgFiles = @(Get-ChildItem -LiteralPath (Join-Path $outputRoot 'posters') -File -Filter '*.jpg')
  if ($mp4Files.Count -ne 16 -or $jpgFiles.Count -ne 16) {
    throw "Output count unexpected: $($mp4Files.Count) MP4, $($jpgFiles.Count) JPG"
  }

  Write-Host "Ready: $outputRoot (16 MP4 and 16 JPG)" -ForegroundColor Green
  Write-Host 'Do not upload or replace manifest automatically.'
  Write-Host 'Upload the complete versioned folder first, verify remote files, then run the manifest command using the existing CloudBase base.'
} finally {
  Pop-Location
}
