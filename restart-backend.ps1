# Restart FastAPI backend: free port 8000, then run uvicorn from this project root.
$ErrorActionPreference = "Stop"
$Port = 8000
$BindHost = "127.0.0.1"

Set-Location $PSScriptRoot

$pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
if ($pids) {
    $pids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

python -m uvicorn app.main:app --reload --host $BindHost --port $Port
