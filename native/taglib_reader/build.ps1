$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $root "..\..")
$outDir = Join-Path $root "build"
$cliObj = Join-Path $outDir "taglib_reader_cli.obj"
$cliOut = Join-Path $outDir "taglib_reader_cli.exe"

$taglibRoot = "D:\1Music\taglib\taglib\build-win\install"
$taglibInclude = Join-Path $taglibRoot "include"
$utfcppInclude = Join-Path $taglibRoot "include\utf8cpp"
$taglibLib = Join-Path $taglibRoot "lib\tag.lib"

foreach ($path in @($taglibInclude, $taglibLib)) {
  if (!(Test-Path $path)) {
    throw "Missing dependency: $path"
  }
}

New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$vsDevCmd = "C:\Program Files\Microsoft Visual Studio\2022\Community\Common7\Tools\VsDevCmd.bat"
$cliClArgs = @(
  "/nologo",
  "/std:c++17",
  "/EHsc",
  "/MD",
  "/O2",
  "/DTAGLIB_STATIC",
  "/I`"$taglibInclude`"",
  "/I`"$utfcppInclude`"",
  "/c",
  "`"$(Join-Path $root "taglib_reader_cli.cpp")`"",
  "/Fo`"$cliObj`""
) -join " "

$cliLinkArgs = @(
  "/nologo",
  "/OUT:`"$cliOut`"",
  "`"$cliObj`"",
  "`"$taglibLib`"",
  "Advapi32.lib",
  "Shell32.lib",
  "Ole32.lib",
  "User32.lib"
) -join " "

$command = "`"$vsDevCmd`" -arch=x64 && cl $cliClArgs && link $cliLinkArgs"
& $env:ComSpec /d /c $command
if ($LASTEXITCODE -ne 0) {
  throw "Native build failed with exit code $LASTEXITCODE"
}

Write-Host "Built $cliOut"
