# Run Vite dev server for the React frontend (default URL http://localhost:5173).
# API calls are proxied to the backend at http://127.0.0.1:8000 — start the backend separately.
$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot
Set-Location frontend

npm run dev
