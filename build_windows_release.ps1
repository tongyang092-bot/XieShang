[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$projectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$frontendRoot = Join-Path $projectRoot 'frontend'
$backendRoot = Join-Path $projectRoot 'backend'
$pythonPath = Join-Path $backendRoot 'venv\Scripts\python.exe'
$pyinstallerPath = Join-Path $backendRoot 'venv\Scripts\pyinstaller.exe'
$specPath = Join-Path $backendRoot 'xieshang_desktop.spec'
$releaseRoot = Join-Path $projectRoot 'release'
$packageRoot = Join-Path $releaseRoot 'XieShang-Windows-x64'
$archivePath = Join-Path $releaseRoot 'XieShang-Windows-x64.zip'
$pyinstallerDist = Join-Path $backendRoot 'dist-release'
$pyinstallerWork = Join-Path $backendRoot 'build-release'

function Remove-BuildPath {
    param([string]$TargetPath)

    $resolvedParent = [System.IO.Path]::GetFullPath((Split-Path -Parent $TargetPath))
    if (-not $resolvedParent.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to delete a path outside the workspace: $TargetPath"
    }
    if (Test-Path -LiteralPath $TargetPath) {
        Remove-Item -LiteralPath $TargetPath -Recurse -Force
    }
}

if (-not (Test-Path -LiteralPath $pythonPath -PathType Leaf)) {
    throw "Backend virtual-environment Python was not found: $pythonPath"
}

Write-Host '[1/5] Building frontend assets...' -ForegroundColor Cyan
Push-Location $frontendRoot
try {
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
}
finally {
    Pop-Location
}

Write-Host '[2/5] Checking PyInstaller...' -ForegroundColor Cyan
if (-not (Test-Path -LiteralPath $pyinstallerPath -PathType Leaf)) {
    & $pythonPath -m pip install "pyinstaller>=6.10,<7"
    if ($LASTEXITCODE -ne 0) { throw 'PyInstaller installation failed.' }
}

Write-Host '[3/5] Building Windows executable...' -ForegroundColor Cyan
Remove-BuildPath $pyinstallerDist
Remove-BuildPath $pyinstallerWork
& $pythonPath -m PyInstaller --noconfirm --clean --distpath $pyinstallerDist --workpath $pyinstallerWork $specPath
if ($LASTEXITCODE -ne 0) { throw 'PyInstaller build failed.' }

Write-Host '[4/5] Preparing competition package...' -ForegroundColor Cyan
Remove-BuildPath $packageRoot
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
Copy-Item -Path (Join-Path $pyinstallerDist 'XieShang\*') -Destination $packageRoot -Recurse -Force
Copy-Item -LiteralPath (Join-Path $projectRoot '.env.example') -Destination (Join-Path $packageRoot 'config.env.example') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'docs\EXECUTABLE_GUIDE.md') -Destination (Join-Path $packageRoot 'RUN_GUIDE.md') -Force
Copy-Item -LiteralPath (Join-Path $projectRoot 'demo-assets') -Destination (Join-Path $packageRoot 'demo-assets') -Recurse -Force

$unsafeEnvFiles = Get-ChildItem -LiteralPath $packageRoot -Recurse -Force -File | Where-Object { $_.Name -eq '.env' }
if ($unsafeEnvFiles) {
    throw 'A .env file was found in the release directory. Packaging has been stopped.'
}

Write-Host '[5/5] Creating upload ZIP...' -ForegroundColor Cyan
if (Test-Path -LiteralPath $archivePath) {
    Remove-Item -LiteralPath $archivePath -Force
}
Compress-Archive -Path (Join-Path $packageRoot '*') -DestinationPath $archivePath -CompressionLevel Optimal

$archive = Get-Item -LiteralPath $archivePath
Write-Host "Build complete: $($archive.FullName)" -ForegroundColor Green
Write-Host ("Archive size: {0:N2} MB" -f ($archive.Length / 1MB)) -ForegroundColor Green
