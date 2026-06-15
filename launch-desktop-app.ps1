$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectDir

$distIndex = Join-Path $projectDir "dist\index.html"
if (-not (Test-Path -LiteralPath $distIndex)) {
    & "npm" run build 2>$null
}

$electronExe = Join-Path $projectDir "node_modules\electron\dist\electron.exe"
Start-Process -FilePath $electronExe -ArgumentList "`"$projectDir`"" -WindowStyle Hidden -Wait
