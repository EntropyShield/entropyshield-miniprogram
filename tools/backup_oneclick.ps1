param(
  [string]$Server = "139.199.195.88",
  [string]$RemoteScript = "/root/backup_server.sh"
)

$ErrorActionPreference = "Stop"

Write-Host "========== Entropy Backup Start ==========" -ForegroundColor Cyan
Write-Host "[1/4] Run remote backup script: $RemoteScript" -ForegroundColor Yellow

$oldEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"

$raw = & ssh "root@$Server" $RemoteScript 2>&1
$sshExitCode = $LASTEXITCODE

$ErrorActionPreference = $oldEap

$lines = @(
  $raw |
  ForEach-Object { "$_".Trim() } |
  Where-Object {
    $_ -ne "" -and
    $_ -notmatch '^ssh\.exe\s*:' -and
    $_ -notmatch '^mysqldump:\s*\[Warning\]'
  }
)

if ($sshExitCode -ne 0) {
  $lines | ForEach-Object { Write-Host $_ }
  throw "remote backup script failed"
}

$lines | ForEach-Object { Write-Host $_ }

$paths = @(
  $lines | Where-Object {
    $_ -match '^/root/backup_.*_(my-app\.tar\.gz|entropy_fission\.sql\.gz)$'
  }
)

if ($paths.Count -lt 2) {
  throw "cannot parse backup paths from remote output"
}

$remoteApp = $paths | Where-Object { $_ -like '*_my-app.tar.gz' } | Select-Object -First 1
$remoteDb  = $paths | Where-Object { $_ -like '*_entropy_fission.sql.gz' } | Select-Object -First 1

if (-not $remoteApp) { throw "cannot find remote app backup path" }
if (-not $remoteDb)  { throw "cannot find remote db backup path" }

$ts = (Get-Date).ToString("yyyyMMdd_HHmmss")
$dest = Join-Path $HOME "backup_$ts"
New-Item -ItemType Directory -Force -Path $dest | Out-Null

Write-Host "[2/4] Download app backup..." -ForegroundColor Yellow
& scp "root@${Server}:$remoteApp" "$dest\"
if ($LASTEXITCODE -ne 0) {
  throw "download app backup failed"
}

Write-Host "[3/4] Download db backup..." -ForegroundColor Yellow
& scp "root@${Server}:$remoteDb" "$dest\"
if ($LASTEXITCODE -ne 0) {
  throw "download db backup failed"
}

Write-Host "[4/4] Verify db dump preview..." -ForegroundColor Yellow

$dbFile = Get-ChildItem $dest -Filter "*entropy_fission.sql.gz" | Select-Object -First 1
if (-not $dbFile) {
  throw "db backup file not found locally"
}

$fs = [System.IO.File]::OpenRead($dbFile.FullName)
$gzip = New-Object System.IO.Compression.GzipStream(
  $fs,
  [System.IO.Compression.CompressionMode]::Decompress
)
$reader = New-Object System.IO.StreamReader($gzip)

$previewLines = @()
1..15 | ForEach-Object {
  $previewLines += $reader.ReadLine()
}

$reader.Close()
$gzip.Close()
$fs.Close()

Write-Host ""
Write-Host "========== Local Backup Folder ==========" -ForegroundColor Green
Write-Host $dest
Write-Host ""

Write-Host "========== Local Files ==========" -ForegroundColor Green
Get-ChildItem $dest | Format-Table Name, Length, LastWriteTime -AutoSize

Write-Host ""
Write-Host "========== SQL First 15 Lines ==========" -ForegroundColor Green
$previewLines | ForEach-Object { Write-Host $_ }

$reportPath = Join-Path $dest "backup_report.txt"
@(
  "backup_time: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
  "server: $Server"
  "remote_app: $remoteApp"
  "remote_db: $remoteDb"
  "local_folder: $dest"
  ""
  "sql_first_15_lines:"
  $previewLines
) | Set-Content $reportPath -Encoding UTF8

Write-Host ""
Write-Host "OK: backup finished" -ForegroundColor Green
Write-Host "report: $reportPath" -ForegroundColor Green
Write-Host "========== Entropy Backup End ==========" -ForegroundColor Cyan