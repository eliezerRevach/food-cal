# Stop FastAPI backend: uvicorn workers, then anything still LISTENING on the port.
$ErrorActionPreference = "Continue"
$Port = 8000

Set-Location $PSScriptRoot

function Get-NetstatListenerPids([int] $listenPort) {
    $pids = @()
    netstat -ano | Select-String ":$listenPort\s+.*LISTENING" | ForEach-Object {
        if ($_.Line -match "LISTENING\s+(\d+)") {
            $pids += [int]$Matches[1]
        }
    }
    $pids | Sort-Object -Unique
}

function Stop-ListenerPids([int] $listenPort) {
    foreach ($procId in (Get-NetstatListenerPids $listenPort)) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        & taskkill.exe /F /PID $procId 2>$null | Out-Null
    }
}

Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
    Where-Object { $_.CommandLine -match "uvicorn" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

Start-Sleep -Seconds 1
Stop-ListenerPids $Port

for ($i = 0; $i -lt 8; $i++) {
    $pids = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    if (-not $pids) { break }
    $pids | ForEach-Object {
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
        & taskkill.exe /F /PID $_ 2>$null | Out-Null
    }
    Stop-ListenerPids $Port
    Start-Sleep -Milliseconds 400
}

if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
    Write-Warning "Port $Port is still in use. Close the terminal running uvicorn (Ctrl+C) or end Python in Task Manager."
    exit 1
}

Write-Host "Backend stopped (port $Port free)."
