param(
  [string]$ProjectRoot = "C:\Users\qiudo\WeChatProjects\miniprogram-3"
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot

$pass = @()
$warn = @()
$fail = @()
$info = @()

function Add-Pass($msg) { $script:pass += $msg }
function Add-Warn($msg) { $script:warn += $msg }
function Add-Fail($msg) { $script:fail += $msg }
function Add-Info($msg) { $script:info += $msg }

Write-Host "========== Entropy Share Rule Check Start ==========" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot" -ForegroundColor Yellow
Write-Host ""

# --------------------------------------------------
# 1) Basic file existence
# --------------------------------------------------
$appJsPath = Join-Path $ProjectRoot "app.js"
$appJsonPath = Join-Path $ProjectRoot "app.json"

if (Test-Path $appJsPath) {
  Add-Pass "exists: app.js"
} else {
  Add-Fail "missing: app.js"
}

if (Test-Path $appJsonPath) {
  Add-Pass "exists: app.json"
} else {
  Add-Fail "missing: app.json"
}

if ($fail.Count -gt 0) {
  Write-Host "========== PASS ==========" -ForegroundColor Green
  $pass | ForEach-Object { Write-Host "[PASS] $_" -ForegroundColor Green }

  Write-Host ""
  Write-Host "========== WARN ==========" -ForegroundColor Yellow
  if ($warn.Count -eq 0) { Write-Host "(none)" }

  Write-Host ""
  Write-Host "========== FAIL ==========" -ForegroundColor Red
  $fail | ForEach-Object { Write-Host "[FAIL] $_" -ForegroundColor Red }

  Write-Host ""
  Write-Host "GLOBAL SHARE RULE NOT READY" -ForegroundColor Red
  Write-Host "========== Entropy Share Rule Check End ==========" -ForegroundColor Cyan
  exit 1
}

# --------------------------------------------------
# 2) app.js global share patch check
# --------------------------------------------------
$appJsText = [System.IO.File]::ReadAllText($appJsPath)

if ($appJsText -match 'GLOBAL_SHARE_ALL_PAGES') {
  Add-Pass "global share patch marker found"
} else {
  Add-Fail "global share patch marker not found"
}

if ($appJsText -match "wx\.showShareMenu" -and $appJsText -match "shareTimeline") {
  Add-Pass "showShareMenu with shareTimeline found"
} else {
  Add-Fail "showShareMenu with shareTimeline not found"
}

if ($appJsText -match "opts\.onShareTimeline\s*=\s*function") {
  Add-Pass "default onShareTimeline injection found"
} else {
  Add-Fail "default onShareTimeline injection not found"
}

if ($appJsText -match "opts\.onShareAppMessage\s*=\s*function") {
  Add-Pass "default onShareAppMessage injection found"
} else {
  Add-Warn "default onShareAppMessage injection not found"
}

# --------------------------------------------------
# 3) app.json pages check
# --------------------------------------------------
try {
  $jsonText = [System.IO.File]::ReadAllText($appJsonPath)
  $appJson = $jsonText | ConvertFrom-Json
  $pages = @($appJson.pages)

  if ($pages.Count -gt 0) {
    Add-Pass "app.json pages count: $($pages.Count)"
  } else {
    Add-Fail "app.json pages array is empty"
  }

  foreach ($p in $pages) {
    $pageJs = Join-Path $ProjectRoot ($p + ".js")
    if (-not (Test-Path $pageJs)) {
      Add-Warn "page js missing: $p.js"
    }
  }
} catch {
  Add-Fail "app.json parse failed"
  $pages = @()
}

# --------------------------------------------------
# 4) Scan local page share declarations
# --------------------------------------------------
$pageJsFiles = Get-ChildItem (Join-Path $ProjectRoot "pages") -Recurse -File -Filter "*.js"

$localTimelineHits = @()
$localShowMenuHits = @()

foreach ($file in $pageJsFiles) {
  $text = [System.IO.File]::ReadAllText($file.FullName)

  if ($text -match "onShareTimeline\s*\(") {
    $localTimelineHits += $file.FullName.Replace($ProjectRoot + "\", "")
  }

  if ($text -match "showShareMenu\s*\(") {
    $localShowMenuHits += $file.FullName.Replace($ProjectRoot + "\", "")
  }
}

if ($localTimelineHits.Count -gt 0) {
  Add-Info "local onShareTimeline found in:"
  $localTimelineHits | ForEach-Object { Add-Info "  $_" }
} else {
  Add-Info "no page-level onShareTimeline found; relying on global patch"
}

if ($localShowMenuHits.Count -gt 0) {
  Add-Info "local showShareMenu found in:"
  $localShowMenuHits | ForEach-Object { Add-Info "  $_" }
} else {
  Add-Info "no page-level showShareMenu found; relying on global patch"
}

# --------------------------------------------------
# 5) Final summary
# --------------------------------------------------
Write-Host "========== PASS ==========" -ForegroundColor Green
if ($pass.Count -eq 0) {
  Write-Host "(none)"
} else {
  $pass | ForEach-Object { Write-Host "[PASS] $_" -ForegroundColor Green }
}

Write-Host ""
Write-Host "========== WARN ==========" -ForegroundColor Yellow
if ($warn.Count -eq 0) {
  Write-Host "(none)"
} else {
  $warn | ForEach-Object { Write-Host "[WARN] $_" -ForegroundColor Yellow }
}

Write-Host ""
Write-Host "========== FAIL ==========" -ForegroundColor Red
if ($fail.Count -eq 0) {
  Write-Host "(none)"
} else {
  $fail | ForEach-Object { Write-Host "[FAIL] $_" -ForegroundColor Red }
}

Write-Host ""
Write-Host "========== INFO ==========" -ForegroundColor Cyan
if ($info.Count -eq 0) {
  Write-Host "(none)"
} else {
  $info | ForEach-Object { Write-Host $_ -ForegroundColor Cyan }
}

Write-Host ""
if ($fail.Count -eq 0) {
  Write-Host "GLOBAL SHARE RULE OK" -ForegroundColor Green
  Write-Host "========== Entropy Share Rule Check End ==========" -ForegroundColor Cyan
  exit 0
} else {
  Write-Host "GLOBAL SHARE RULE NOT READY" -ForegroundColor Red
  Write-Host "========== Entropy Share Rule Check End ==========" -ForegroundColor Cyan
  exit 1
}