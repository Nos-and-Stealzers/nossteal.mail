@echo off
REM Stops the nossteal.mail dev processes by freeing their ports (4000, 2525, 3000).
echo Stopping nossteal.mail services...
powershell -NoProfile -Command ^
  "foreach ($p in 4000,2525,3000) { Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { try { Stop-Process -Id $_ -Force -ErrorAction Stop; Write-Host \"Stopped PID $_ on port $p\" } catch {} } }"
echo Done.
pause
