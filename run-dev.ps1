# Run FastAPI backend and Vite frontend together.
# Backend: reuses restart-backend.ps1 in a new window (http://127.0.0.1:8000).
# Frontend: npm run dev in this window (http://localhost:5173).
# Stop backend: close that window or run .\stop-backend.ps1
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$backendScript = Join-Path $PSScriptRoot "restart-backend.ps1"
if (-not (Test-Path $backendScript)) {
    throw "Missing $backendScript"
}

Start-Process powershell.exe -ArgumentList @(
    "-NoExit",
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $backendScript
) | Out-Null

Start-Sleep -Seconds 1

Set-Location (Join-Path $PSScriptRoot "frontend")
npm run dev
