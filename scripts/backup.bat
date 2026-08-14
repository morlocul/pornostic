@echo off
REM Weekly local DB backup wrapper for Windows Task Scheduler.
cd /d "G:\PRONOSTIC APP"
"C:\Program Files\nodejs\node.exe" scripts\backup-db.mjs >> "G:\PRONOSTIC APP\backups\backup.log" 2>&1
