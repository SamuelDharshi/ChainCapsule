param()
# ============================================================
# ChainCapsule — Chrome Extension Packager
# Run from: d:\ChainCapsule\app\
#   .\package-extension.ps1
#
# After running, reload the extension in Chrome:
#   chrome://extensions → ChainCapsule → click refresh icon
# ============================================================

Set-StrictMode -Off
$ErrorActionPreference = "Continue"
$outDir = "D:\ChainCapsule\app\out"

Write-Host ""
Write-Host "=== ChainCapsule Extension Packager ===" -ForegroundColor Cyan
Write-Host ""

# -- Build static export (assetPrefix=/next_assets baked in at build time) --
Write-Host "Building static export for Chrome extension..." -ForegroundColor Cyan
$env:NEXT_EXPORT = "1"
npm run build 2>&1 | Write-Host -ForegroundColor Gray
$env:NEXT_EXPORT = ""

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed." -ForegroundColor Red
    exit 1
}
Write-Host "Build succeeded!" -ForegroundColor Green
Write-Host ""

# -- Fix: Chrome blocks TOP-LEVEL folders starting with '_' --
Write-Host "Fixing folder names for Chrome..." -ForegroundColor Cyan

# Rename _next → next_assets (assetPrefix already baked into JS at build time)
if (Test-Path "$outDir\_next") {
    Rename-Item "$outDir\_next" "next_assets" -Force
    Write-Host "  Renamed _next → next_assets" -ForegroundColor Gray
}

# Rename _not-found → not-found
if (Test-Path "$outDir\_not-found") {
    Rename-Item "$outDir\_not-found" "not-found" -Force
    Write-Host "  Renamed _not-found → not-found" -ForegroundColor Gray
}

# Remove ONLY top-level underscore files (txt metadata, not JS)
$topLevel = Get-ChildItem $outDir | Where-Object { $_.Name -like "_*" }
foreach ($item in $topLevel) {
    if ($item.PSIsContainer) { Remove-Item -LiteralPath $item.FullName -Recurse -Force }
    else { Remove-Item -LiteralPath $item.FullName -Force }
}
Write-Host "  Removed $($topLevel.Count) top-level underscore items" -ForegroundColor Gray

# Verify clean
$remaining = (Get-ChildItem $outDir | Where-Object { $_.Name -like "_*" }).Count
Write-Host "  Top-level underscore items remaining: $remaining" -ForegroundColor $(if ($remaining -eq 0) {"Green"} else {"Red"})
Write-Host "Done." -ForegroundColor Green
Write-Host ""

# -- Package zip --
$zipPath = "D:\ChainCapsule\ChainCapsule-Extension.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$outDir\*" -DestinationPath $zipPath
Write-Host "Extension zip: $zipPath ($([math]::Round((Get-Item $zipPath).Length/1MB,2)) MB)" -ForegroundColor Green

Write-Host ""
Write-Host "=== Reload in Chrome ===" -ForegroundColor Cyan
Write-Host "1. Go to: chrome://extensions" -ForegroundColor Yellow
Write-Host "2. Click the refresh icon on ChainCapsule card" -ForegroundColor Yellow
Write-Host "3. Click the extension icon — all pages should work!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Done!" -ForegroundColor Green
