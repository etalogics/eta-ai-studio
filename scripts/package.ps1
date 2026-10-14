$ErrorActionPreference = 'Stop'
$studioRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$deliveryRoot = Join-Path $studioRoot 'delivery'
$packageRoot = Join-Path $deliveryRoot ('ai-creator-studio-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $packageRoot -Force | Out-Null
Push-Location $studioRoot
try {
  $trackedFiles = git ls-files
  if ($LASTEXITCODE -ne 0) { throw 'Could not enumerate tracked project files.' }
  foreach ($relativeFile in $trackedFiles) {
    $sourceFile = [IO.Path]::GetFullPath((Join-Path $studioRoot $relativeFile))
    if (-not $sourceFile.StartsWith($studioRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Invalid source path.' }
    $destinationFile = Join-Path $packageRoot $relativeFile
    New-Item -ItemType Directory -Path (Split-Path -Parent $destinationFile) -Force | Out-Null
    Copy-Item -LiteralPath $sourceFile -Destination $destinationFile
  }
  $archivePath = $packageRoot + '.zip'
  Compress-Archive -LiteralPath $packageRoot -DestinationPath $archivePath
  Write-Output $archivePath
} finally { Pop-Location }
