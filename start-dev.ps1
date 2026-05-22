# Start full stack: stop any existing uvicorn on :8000, start one backend, run Vite in this window.
# On exit (or Ctrl+C), backend is stopped again so you do not accumulate duplicate servers.
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$Port = 8000
$BindHost = "127.0.0.1"
$stopScript = Join-Path $PSScriptRoot (Join-Path "scripts" "stop-backend.ps1")
if (-not (Test-Path $stopScript)) {
    throw "Missing $stopScript"
}

function Invoke-StopBackend {
    # Single string: array form splits paths at spaces (e.g. "food cal") and breaks -File.
    $psArgs = "-NoProfile -ExecutionPolicy Bypass -File `"$stopScript`""
    $p = Start-Process -FilePath "powershell.exe" -ArgumentList $psArgs -Wait -PassThru -NoNewWindow
    if ($p.ExitCode -ne 0) {
        throw "stop-backend.ps1 failed (exit $($p.ExitCode)). Port $Port may still be in use."
    }
}

# Clear old backend so a second run of this script does not stack multiple uvicorns.
Invoke-StopBackend

$uvicornArgs = @(
    "-m", "uvicorn", "app.main:app",
    "--reload",
    "--host", $BindHost,
    "--port", "$Port"
)
$backendProc = Start-Process -FilePath "python" -ArgumentList $uvicornArgs `
    -WorkingDirectory $PSScriptRoot `
    -WindowStyle Minimized `
    -PassThru

Start-Sleep -Seconds 2
if ($backendProc.HasExited) {
    throw "Backend exited right after start. Check Python, dependencies, and app.main:app (a minimized window may have flashed an error)."
}

$frontend = Join-Path $PSScriptRoot "frontend"
if (-not (Test-Path (Join-Path $frontend "package.json"))) {
    throw "Missing frontend/package.json under $PSScriptRoot"
}

try {
    Set-Location $frontend
    npm run dev
}
finally {
    Set-Location $PSScriptRoot
    try {
        Invoke-StopBackend
    }
    catch {
        Write-Warning $_.Exception.Message
    }
}
