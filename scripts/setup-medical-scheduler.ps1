# setup-medical-scheduler.ps1
# Registers a Windows Task Scheduler task to run the Wafid medical status check
# twice daily: 8:00 AM and 2:00 PM.
#
# Run once as Administrator:
#   powershell -ExecutionPolicy Bypass -File "scripts\setup-medical-scheduler.ps1"

$TaskName   = "FlowPath-MedicalStatusCheck"
$ScriptPath = "$PSScriptRoot\run-medical-check.bat"
$ProjectDir = Split-Path $PSScriptRoot -Parent

# Create logs directory if it doesn't exist
$logsDir = Join-Path $ProjectDir "logs"
if (-not (Test-Path $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
    Write-Host "Created logs\ directory"
}

# Remove existing task if present
if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing task: $TaskName"
}

# Morning trigger: 8:00 AM daily
$triggerMorning   = New-ScheduledTaskTrigger -Daily -At "08:00"
# Afternoon trigger: 2:00 PM daily
$triggerAfternoon = New-ScheduledTaskTrigger -Daily -At "14:00"

$action = New-ScheduledTaskAction `
    -Execute "cmd.exe" `
    -Argument "/c `"$ScriptPath`"" `
    -WorkingDirectory $ProjectDir

$settings = New-ScheduledTaskSettingsSet `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable

$principal = New-ScheduledTaskPrincipal `
    -UserId $env:USERNAME `
    -LogonType S4U `
    -RunLevel Limited

$task = New-ScheduledTask `
    -Action $action `
    -Trigger @($triggerMorning, $triggerAfternoon) `
    -Settings $settings `
    -Principal $principal `
    -Description "Checks Wafid medical status for Ethiopian candidates and updates FlowPath database"

Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force

Write-Host ""
Write-Host "Task registered: $TaskName"
Write-Host "  Runs at: 8:00 AM and 2:00 PM daily"
Write-Host "  Script:  $ScriptPath"
Write-Host "  Logs:    $logsDir\medical-check-scheduler.log"
Write-Host ""
Write-Host "To run immediately:"
Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
Write-Host ""
Write-Host "To remove:"
Write-Host "  Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
