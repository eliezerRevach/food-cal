# Run FastAPI backend and Vite frontend together (legacy copy under old/).
# Repo root is parent of this folder.
$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $RepoRoot

$backendScript = Join-Path $RepoRoot (Join-Path "scripts" "restart-backend.ps1")
if (-not (Test-Path $backendScript)) {
    throw "Missing $backendScript"
}

# Single string: array form splits paths at spaces (e.g. "food cal") and breaks -File.
$psArgs = "-NoExit -NoProfile -ExecutionPolicy Bypass -File `"$backendScript`""
Start-Process powershell.exe -ArgumentList $psArgs | Out-Null

Start-Sleep -Seconds 1

Set-Location (Join-Path $RepoRoot "frontend")
npm run dev
