# nossteal.mail launcher
# Starts Postgres (if needed), the API server, the inbound SMTP receiver,
# and the Next.js web app — each in its own window — then opens the browser.

$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$server = Join-Path $root 'server'
$web = Join-Path $root 'web'

Write-Host '=== nossteal.mail — starting backend ===' -ForegroundColor Cyan

# 1. Ensure PostgreSQL is running.
$pg = Get-Service -Name 'postgresql-x64-16' -ErrorAction SilentlyContinue
if ($null -eq $pg) {
    Write-Host '! PostgreSQL service postgresql-x64-16 not found. Install it or edit this script.' -ForegroundColor Yellow
} elseif ($pg.Status -ne 'Running') {
    Write-Host 'Starting PostgreSQL...' -ForegroundColor Yellow
    try { Start-Service $pg } catch {
        Write-Host '! Could not start PostgreSQL (needs admin). Start it manually, then re-run.' -ForegroundColor Red
    }
} else {
    Write-Host 'PostgreSQL: running' -ForegroundColor Green
}

# 2. Install deps on first run.
if (-not (Test-Path (Join-Path $server 'node_modules'))) {
    Write-Host 'Installing server dependencies (first run)...' -ForegroundColor Yellow
    Push-Location $server; npm install; Pop-Location
}
if (-not (Test-Path (Join-Path $web 'node_modules'))) {
    Write-Host 'Installing web dependencies (first run)...' -ForegroundColor Yellow
    Push-Location $web; npm install; Pop-Location
}

# 3. Launch the three processes, each in its own titled window.
function Start-Proc($title, $dir, $cmd) {
    Start-Process powershell -ArgumentList @(
        '-NoExit', '-NoProfile', '-Command',
        "`$host.UI.RawUI.WindowTitle='$title'; Set-Location '$dir'; $cmd"
    )
    Write-Host "Started: $title" -ForegroundColor Green
}

Start-Proc 'nossteal API (:4000)'      $server 'npm run dev'
Start-Proc 'nossteal SMTP (:2525)'     $server 'npm run mailserver'
Start-Proc 'nossteal Web (:3000)'      $web    'npm run dev'

# 4. Wait for the API health check, then open the app.
Write-Host 'Waiting for API to come up...' -ForegroundColor Yellow
$up = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-RestMethod -Uri 'http://localhost:4000/health' -TimeoutSec 2
        if ($r.status -eq 'ok') { $up = $true; break }
    } catch { Start-Sleep -Seconds 1 }
}
if ($up) {
    Write-Host 'API is up. Opening http://localhost:3000 ...' -ForegroundColor Green
    Start-Process 'http://localhost:3000'
} else {
    Write-Host '! API did not respond in time — check the "nossteal API" window for errors.' -ForegroundColor Red
}

Write-Host ''
Write-Host 'All services launched in separate windows.' -ForegroundColor Cyan
Write-Host 'Log in at http://localhost:3000' -ForegroundColor Cyan
Write-Host 'To stop everything, run stop.bat (or close the three windows).' -ForegroundColor Cyan
