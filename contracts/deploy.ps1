param()

# ============================================================
# ChainCapsule -- Contract Deploy + Env Auto-Update Script
# Run from: d:\ChainCapsule\contracts\
# ============================================================

Set-StrictMode -Off
$ErrorActionPreference = "Continue"

Write-Host ""
Write-Host "=== ChainCapsule Deploy Script ===" -ForegroundColor Cyan
Write-Host ""

# -- Check Sui CLI --
$suiVer = (sui --version 2>&1)
Write-Host "Sui CLI: $suiVer" -ForegroundColor Gray

$activeAddr = (sui client active-address 2>&1)
$activeEnv  = (sui client active-env  2>&1)
Write-Host "Address : $activeAddr" -ForegroundColor Yellow
Write-Host "Network : $activeEnv"  -ForegroundColor Yellow
Write-Host ""

# -- Gas check --
Write-Host "Checking gas balance..." -ForegroundColor Cyan
$gasOutput = (sui client gas 2>&1) | Out-String
if ($gasOutput -match "No gas") {
    Write-Host "ERROR: No gas coins found." -ForegroundColor Red
    Write-Host "Get testnet SUI at: https://faucet.sui.io/?address=$activeAddr" -ForegroundColor Blue
    exit 1
}
Write-Host $gasOutput -ForegroundColor Gray

# -- Build --
Write-Host "Building Move package..." -ForegroundColor Cyan
$buildOutput = (sui move build 2>&1) | Out-String
Write-Host $buildOutput -ForegroundColor Gray
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed." -ForegroundColor Red
    exit 1
}
Write-Host "Build succeeded." -ForegroundColor Green
Write-Host ""

# -- Publish --
Write-Host "Publishing to Sui Testnet..." -ForegroundColor Cyan
$args = @("client", "publish", "--gas-budget", "100000000", "--skip-dependency-verification")
$publishOutput = (& sui @args 2>&1) | Out-String
Write-Host $publishOutput -ForegroundColor Gray

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Publish failed." -ForegroundColor Red
    exit 1
}

# -- Extract Package ID --
$packageId = $null

# Pattern 1: "PackageID: 0x..."
if ($publishOutput -match "PackageID:\s*(0x[a-f0-9]+)") {
    $packageId = $Matches[1]
}

# Pattern 2: look for Published Objects hex
if (-not $packageId) {
    $lines = $publishOutput -split "`n"
    foreach ($line in $lines) {
        if ($line -match "(0x[a-f0-9]{64})") {
            $packageId = $Matches[1]
            break
        }
    }
}

if ($packageId) {
    Write-Host ""
    Write-Host "SUCCESS! PACKAGE_ID = $packageId" -ForegroundColor Green

    # Auto-update .env.local
    $envPath = Join-Path $PSScriptRoot "..\app\.env.local"
    if (Test-Path $envPath) {
        $content = Get-Content $envPath -Raw
        $content = $content -replace "NEXT_PUBLIC_PACKAGE_ID=.*", "NEXT_PUBLIC_PACKAGE_ID=$packageId"
        Set-Content -Path $envPath -Value $content -NoNewline
        Write-Host "Updated .env.local with PACKAGE_ID" -ForegroundColor Green
    } else {
        Write-Host "WARNING: .env.local not found at $envPath" -ForegroundColor Yellow
        Write-Host "Set manually: NEXT_PUBLIC_PACKAGE_ID=$packageId"
    }

    Write-Host ""
    Write-Host "View on SuiScan: https://suiscan.xyz/testnet/object/$packageId" -ForegroundColor Blue
} else {
    Write-Host ""
    Write-Host "WARNING: Could not auto-extract PACKAGE_ID." -ForegroundColor Yellow
    Write-Host "Check the publish output above for a line containing 'PackageID' or a 0x... hex address."
    Write-Host "Then manually set: NEXT_PUBLIC_PACKAGE_ID=0x... in app\.env.local"
}

Write-Host ""
Write-Host "Done! Restart your Next.js dev server to pick up the new PACKAGE_ID." -ForegroundColor Green
