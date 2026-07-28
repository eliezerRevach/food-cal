# Restart FastAPI backend: free port 8002, then run uvicorn from project root (parent of scripts/).
$ErrorActionPreference = "Stop"
$Port = 8002
$BindHost = "127.0.0.1"

$ProjectRoot = Split-Path $PSScriptRoot -Parent
Set-Location $ProjectRoot

$pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
if ($pids) {
    $pids | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 1
}

python -m uvicorn app.main:app --reload --host $BindHost --port $Port
