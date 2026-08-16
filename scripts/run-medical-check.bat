@echo off
REM Runs the Wafid medical status checker via Windows Task Scheduler.
REM Bun automatically reads .env from the project directory.

cd /d "C:\Project\flowpath-suite"

bun run check-medical >> "C:\Project\flowpath-suite\logs\medical-check-scheduler.log" 2>&1
echo [%date% %time%] Scheduler run finished >> "C:\Project\flowpath-suite\logs\medical-check-scheduler.log"
