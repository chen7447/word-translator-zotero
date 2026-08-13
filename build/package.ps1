# Word Translator for Zotero - XPI build script
# Usage: run in build dir:  powershell -ExecutionPolicy Bypass -File package.ps1
$ErrorActionPreference = "Stop"
$buildDir = $PSScriptRoot
if (-not $buildDir) { $buildDir = Split-Path -Parent $MyInvocation.MyCommand.Path }
$addonDir = Join-Path $buildDir "addon"

# Read version from manifest.json
$manifest = [System.Text.Encoding]::UTF8.GetString([System.IO.File]::ReadAllBytes((Join-Path $addonDir "manifest.json")))
if ($manifest -match '"version"\s*:\s*"([^"]+)"') {
  $ver = $Matches[1]
} else {
  throw "version not found in manifest.json"
}

# Pack with pack_xpi.py (entries have no ./ prefix, matching official XPI layout)
$packer = Join-Path $buildDir "pack_xpi.py"
$xpi = Join-Path $buildDir ("wordtranslator-" + $ver + ".xpi")
$packOut = & py -3 $packer $addonDir $xpi 2>&1
if ($LASTEXITCODE -ne 0) { throw "pack failed: $packOut" }
Write-Output ("OK: " + $xpi + " (" + (Get-Item $xpi).Length + " bytes)")
