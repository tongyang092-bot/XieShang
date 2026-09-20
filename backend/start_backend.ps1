[CmdletBinding()]
param(
    [switch]$Restart,
    [ValidateRange(1, 65535)]
    [int]$Port = 8000,
    [string]$HostAddress = '127.0.0.1'
)

$ErrorActionPreference = 'Stop'

$backendRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$pythonPath = [System.IO.Path]::GetFullPath((Join-Path $backendRoot 'venv\Scripts\python.exe'))

if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
    throw "未找到后端虚拟环境：$pythonPath。请先在 backend 目录创建 venv 并安装依赖。"
}

function Get-PortListener {
    param([int]$TargetPort)

    return Get-NetTCPConnection -LocalPort $TargetPort -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

function Get-ProcessInfo {
    param([int]$ProcessId)

    return Get-CimInstance Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction SilentlyContinue
}

$listener = Get-PortListener -TargetPort $Port
if ($listener) {
    $listenerPid = [int]$listener.OwningProcess
    $listenerProcess = Get-ProcessInfo -ProcessId $listenerPid
    $parentProcess = if ($listenerProcess) { Get-ProcessInfo -ProcessId ([int]$listenerProcess.ParentProcessId) } else { $null }
    $listenerCommand = if ($listenerProcess.CommandLine) { $listenerProcess.CommandLine } else { '' }
    $parentCommand = if ($parentProcess.CommandLine) { $parentProcess.CommandLine } else { '' }
    $combinedCommand = "$listenerCommand`n$parentCommand"
    $expectedCommand = [Regex]::Escape($pythonPath)
    $isThisProject = $combinedCommand -match 'uvicorn\s+app\.main:app' -and $combinedCommand -match $expectedCommand

    if (-not $isThisProject) {
        $ownerName = if ($listenerProcess.Name) { $listenerProcess.Name } else { '未知进程' }
        throw "端口 $Port 已被其他程序占用（PID $listenerPid，$ownerName）。为避免误杀进程，脚本已停止。请更换端口或手动处理该程序。"
    }

    if (-not $Restart) {
        Write-Host "后端已经在 http://${HostAddress}:$Port 运行（PID $listenerPid）。无需重复启动。" -ForegroundColor Yellow
        Write-Host "如需重新加载代码，请执行：.\start_backend.ps1 -Restart" -ForegroundColor Cyan
        exit 0
    }

    Write-Host "正在停止当前项目的旧后端进程（PID $listenerPid）..." -ForegroundColor Yellow
    Stop-Process -Id $listenerPid -Force -ErrorAction SilentlyContinue

    if ($parentProcess -and $parentProcess.ProcessId -ne $listenerPid -and $parentCommand -match $expectedCommand) {
        Stop-Process -Id ([int]$parentProcess.ProcessId) -Force -ErrorAction SilentlyContinue
    }

    $deadline = [DateTime]::UtcNow.AddSeconds(5)
    do {
        Start-Sleep -Milliseconds 200
        $listener = Get-PortListener -TargetPort $Port
    } while ($listener -and [DateTime]::UtcNow -lt $deadline)

    if ($listener) {
        throw "旧后端进程未能在 5 秒内释放端口 $Port，请在任务管理器中检查 PID $($listener.OwningProcess)。"
    }
}

Write-Host "正在启动 XieShang 后端：http://${HostAddress}:$Port" -ForegroundColor Green
Push-Location $backendRoot
try {
    & $pythonPath -m uvicorn app.main:app --host $HostAddress --port $Port
    exit $LASTEXITCODE
}
finally {
    Pop-Location
}
