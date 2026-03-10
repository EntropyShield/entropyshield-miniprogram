param(
  [string]$ProjectRoot = "C:\Users\qiudo\WeChatProjects\miniprogram-3"
)

$ErrorActionPreference = "Stop"

Set-Location $ProjectRoot

$pass = @()
$warn = @()
$fail = @()

function Add-Pass($msg) { $script:pass += $msg }
function Add-Warn($msg) { $script:warn += $msg }
function Add-Fail($msg) { $script:fail += $msg }

Write-Host "========== Entropy Prepublish Check Start ==========" -ForegroundColor Cyan
Write-Host "Project: $ProjectRoot" -ForegroundColor Yellow
Write-Host ""

# --------------------------------------------------
# 1) Basic repo check
# --------------------------------------------------
try {
  $gitRoot = (& git rev-parse --show-toplevel 2>$null).Trim()
  if (-not $gitRoot) {
    throw "not a git repo"
  }
  Add-Pass "git repo detected: $gitRoot"
} catch {
  Add-Fail "git repo not detected"
}

# --------------------------------------------------
# 2) Git status check
# --------------------------------------------------
$allowedDirty = @(
  "project.config.json",
  "project.private.config.json"
)

$dirtyFiles = @()
try {
  $statusLines = @(& git status --porcelain)
  foreach ($line in $statusLines) {
    if (-not [string]::IsNullOrWhiteSpace($line)) {
      $file = $line.Substring(3).Trim()
      if ($file) {
        $dirtyFiles += $file
      }
    }
  }

  if ($dirtyFiles.Count -eq 0) {
    Add-Pass "git working tree clean"
  } else {
    $businessDirty = @(
      $dirtyFiles | Where-Object { $allowedDirty -notcontains $_ }
    )

    if ($businessDirty.Count -eq 0) {
      Add-Warn "only local tool config files are dirty: $($dirtyFiles -join ', ')"
    } else {
      Add-Fail "business files still dirty: $($businessDirty -join ', ')"
    }
  }
} catch {
  Add-Fail "git status check failed"
}

# --------------------------------------------------
# 3) Required files check
# --------------------------------------------------
$requiredFiles = @(
  "app.js",
  "app.json",
  "config.js",
  "pages/index/index.js",
  "pages/index/index.wxml",
  "pages/index/index.wxss",
  "pages/controller/index.js",
  "pages/profile/index.js",
  "pages/fissionTask/index.js",
  "pages/myInvite/index.js",
  "tools/backup_oneclick.ps1"
)

foreach ($file in $requiredFiles) {
  $full = Join-Path $ProjectRoot $file
  if (Test-Path $full) {
    Add-Pass "exists: $file"
  } else {
    Add-Fail "missing required file: $file"
  }
}

# --------------------------------------------------
# 4) app.json page order check
# --------------------------------------------------
try {
  $appJsonPath = Join-Path $ProjectRoot "app.json"
  $jsonText = [System.IO.File]::ReadAllText($appJsonPath)
  $appJson = $jsonText | ConvertFrom-Json

  $pages = @($appJson.pages)

  if ($pages.Count -ge 3) {
    if (
      $pages[0] -eq "pages/index/index" -and
      $pages[1] -eq "pages/controller/index" -and
      $pages[2] -eq "pages/profile/index"
    ) {
      Add-Pass "app.json main page order correct"
    } else {
      Add-Fail "app.json main page order incorrect: $($pages[0]), $($pages[1]), $($pages[2])"
    }
  } else {
    Add-Fail "app.json pages array too short"
  }
} catch {
  Add-Fail "app.json parse failed"
}

# --------------------------------------------------
# 5) Global share patch check
# --------------------------------------------------
try {
  $appJsPath = Join-Path $ProjectRoot "app.js"
  $appJsText = [System.IO.File]::ReadAllText($appJsPath)

  if ($appJsText -match "GLOBAL_SHARE_ALL_PAGES") {
    Add-Pass "global share patch found in app.js"
  } else {
    Add-Fail "global share patch not found in app.js"
  }
} catch {
  Add-Fail "cannot read app.js for share check"
}

# --------------------------------------------------
# 6) Latest backup check
# --------------------------------------------------
try {
  $backupDirs = Get-ChildItem $HOME -Directory -Filter "backup_*" | Sort-Object LastWriteTime -Descending
  if ($backupDirs.Count -eq 0) {
    Add-Warn "no local backup folder found under HOME"
  } else {
    $latestBackup = $backupDirs | Select-Object -First 1
    $reportPath = Join-Path $latestBackup.FullName "backup_report.txt"
    $hours = ((Get-Date) - $latestBackup.LastWriteTime).TotalHours

    if (Test-Path $reportPath) {
      if ($hours -le 72) {
        Add-Pass "recent backup found: $($latestBackup.FullName)"
      } else {
        Add-Warn "backup exists but older than 72 hours: $($latestBackup.FullName)"
      }
    } else {
      Add-Warn "latest backup folder has no backup_report.txt: $($latestBackup.FullName)"
    }
  }
} catch {
  Add-Warn "backup check failed"
}

# --------------------------------------------------
# Output summary
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
if ($fail.Count -eq 0) {
  Write-Host "OK TO PUBLISH" -ForegroundColor Green
  Write-Host "========== Entropy Prepublish Check End ==========" -ForegroundColor Cyan
  exit 0
} else {
  Write-Host "NOT READY TO PUBLISH" -ForegroundColor Red
  Write-Host "========== Entropy Prepublish Check End ==========" -ForegroundColor Cyan
  exit 1
}