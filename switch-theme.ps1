# ============================================================================
# Sync kanagawa-theme files into Antigravity resources and hot-reload via CDP
# Dong bo kanagawa-theme vao Antigravity va reload giao dien ngay qua CDP
# ============================================================================
param(
    [string]$Theme = "kanagawa",
    [switch]$ForceReload
)
$ErrorActionPreference = 'Stop'

$rawTheme = if ($Theme) { $Theme.Trim() } else { 'kanagawa' }
if ($rawTheme -match '^[a-zA-Z0-9_-]+$') {
    $ThemeName = if ($rawTheme -like '*-theme') { $rawTheme } else { "$rawTheme-theme" }
}
else {
    Write-Host "[kanagawa] ERROR: Invalid theme name '$Theme'. Only letters, digits, '_' and '-' are allowed." -ForegroundColor Red
    exit 1
}
$AppDir    = Join-Path $env:LOCALAPPDATA 'Programs\Antigravity'
$Resources = Join-Path $AppDir 'resources'

if (-not (Test-Path $Resources)) {
    Write-Host "[kanagawa] ERROR: Antigravity resources not found at $Resources / Khong tim thay thu muc resources." -ForegroundColor Red
    exit 1
}

$LocalSrc  = Join-Path $PSScriptRoot $ThemeName
$TargetDst = Join-Path $Resources $ThemeName

if (-not (Test-Path $LocalSrc) -and -not (Test-Path $TargetDst)) {
    Write-Host "[kanagawa] ERROR: Theme '$ThemeName' not found at $LocalSrc or $TargetDst." -ForegroundColor Red
    exit 1
}

function Sync-PrunedSubdir {
    param([string]$SrcDir, [string]$DstDir)
    if (-not (Test-Path -LiteralPath $DstDir)) { return }
    $dstPrefix = (Resolve-Path -LiteralPath $DstDir).Path.TrimEnd('\', '/')
    Get-ChildItem -LiteralPath $DstDir -File -Recurse -Force -ErrorAction SilentlyContinue | ForEach-Object {
        $rel = $_.FullName.Substring($dstPrefix.Length).TrimStart('\', '/')
        $srcCandidate = Join-Path $SrcDir $rel
        if (-not (Test-Path -LiteralPath $srcCandidate)) {
            Remove-Item -LiteralPath $_.FullName -Force -Confirm:$false -ErrorAction SilentlyContinue
        }
    }
    Get-ChildItem -LiteralPath $DstDir -Directory -Recurse -Force -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName.Length } -Descending |
        ForEach-Object {
            $children = @(Get-ChildItem -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue)
            if ($children.Count -eq 0) {
                Remove-Item -LiteralPath $_.FullName -Force -Confirm:$false -ErrorAction SilentlyContinue
            }
        }
}

$SyncedFromLocal = $false
if (Test-Path -LiteralPath $LocalSrc) {
    Write-Host "[kanagawa] Syncing $ThemeName / Dang dong bo $ThemeName..." -ForegroundColor Cyan
    if (-not (Test-Path -LiteralPath $TargetDst)) {
        New-Item -ItemType Directory -Path $TargetDst -Force | Out-Null
    }
    $srcPrefix = (Resolve-Path -LiteralPath $LocalSrc).Path.TrimEnd('\', '/')
    Get-ChildItem -LiteralPath $LocalSrc -File -Recurse -Force | ForEach-Object {
        $rel = $_.FullName.Substring($srcPrefix.Length).TrimStart('\', '/')
        $relNorm = $rel.Replace('\', '/')
        if ($relNorm -in @('.live-watch.json', 'repo-link.json')) { return }
        $dstFile = Join-Path $TargetDst $rel
        $dstParent = Split-Path $dstFile -Parent
        if (-not (Test-Path -LiteralPath $dstParent)) {
            New-Item -ItemType Directory -Path $dstParent -Force | Out-Null
        }
        Copy-Item -LiteralPath $_.FullName -Destination $dstFile -Force
    }
    Sync-PrunedSubdir (Join-Path $LocalSrc 'profiles') (Join-Path $TargetDst 'profiles')
    Sync-PrunedSubdir (Join-Path $LocalSrc 'assets') (Join-Path $TargetDst 'assets')
    $SyncedFromLocal = $true
}

if (Test-Path $LocalSrc) {
    $RepoLink = @{
        repoRoot  = $PSScriptRoot
        themeDir  = $LocalSrc
        updatedAt = (Get-Date).ToString('o')
    } | ConvertTo-Json
    [System.IO.File]::WriteAllText((Join-Path $TargetDst 'repo-link.json'), $RepoLink, (New-Object System.Text.UTF8Encoding($false)))
}

$ActiveConfig = @{ theme = $ThemeName } | ConvertTo-Json
$ActiveConfigPath = Join-Path $Resources 'active-theme.json'
[System.IO.File]::WriteAllText($ActiveConfigPath, $ActiveConfig, (New-Object System.Text.UTF8Encoding($false)))

$LiveWatchActive = $false
$LiveWatchFile = Join-Path $TargetDst '.live-watch.json'
if (-not $ForceReload -and (Test-Path $LiveWatchFile)) {
    try {
        $lw = Get-Content $LiveWatchFile -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($lw -and $lw.pid) {
            $p = Get-Process -Id ([int]$lw.pid) -ErrorAction SilentlyContinue
            if ($p -and ($p.ProcessName -like '*Antigravity*')) {
                $LiveWatchActive = $true
            }
        }
    } catch {}
}

if ($LiveWatchActive) {
    if ($SyncedFromLocal) {
        $CfgDst = Join-Path $TargetDst 'kanagawa.config.json'
        if (Test-Path $CfgDst) {
            try { (Get-Item $CfgDst).LastWriteTimeUtc = [DateTime]::UtcNow } catch {}
        }
    }
    Write-Host "[kanagawa] Synced! Live hot-watch applied CSS without reloading Antigravity. / Da dong bo va cap nhat giao dien tuc thi (khong can reload)!" -ForegroundColor Green
    exit 0
}

$PortFile = Join-Path $env:APPDATA 'Antigravity\DevToolsActivePort'
$Reloaded = $false

if (Test-Path $PortFile) {
    $TempJs = Join-Path $env:TEMP ('kanagawa_hot_reload_' + [guid]::NewGuid().ToString('N').Substring(0, 8) + '.js')
    try {
        $portLines = @(Get-Content $PortFile -ErrorAction Stop)
        if ($portLines.Count -gt 0 -and $portLines[0]) {
            $Port = $portLines[0].Trim()
            if ($Port -match '^\d+$') {
                $NodeScript = @"
const http = require('http');
http.get('http://127.0.0.1:$Port/json', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const list = JSON.parse(data);
      const pages = list.filter(x => x.type === 'page' && x.url && /^https?:/i.test(x.url) && x.webSocketDebuggerUrl);
      if (pages.length > 0) {
        let left = pages.length;
        for (const page of pages) {
          const ws = new WebSocket(page.webSocketDebuggerUrl);
          ws.onopen = () => {
            ws.send(JSON.stringify({ id: 1, method: 'Page.reload' }));
            setTimeout(() => { try { ws.close(); } catch {} if (--left <= 0) process.exit(0); }, 150);
          };
          ws.onerror = () => { if (--left <= 0) process.exit(1); };
        }
      } else { process.exit(1); }
    } catch(e) { process.exit(1); }
  });
}).on('error', () => process.exit(1));
"@
                [System.IO.File]::WriteAllText($TempJs, $NodeScript, (New-Object System.Text.UTF8Encoding($false)))
                $proc = Start-Process -FilePath 'node' -ArgumentList "`"$TempJs`"" -NoNewWindow -Wait -PassThru -ErrorAction SilentlyContinue
                if ($proc -and $proc.ExitCode -eq 0) { $Reloaded = $true }
            }
        }
    } catch {}
    finally {
        Remove-Item $TempJs -Force -ErrorAction SilentlyContinue
    }
}

if ($Reloaded) {
    Write-Host "[kanagawa] Synced & hot-reloaded Antigravity! / Da dong bo va reload giao dien thanh cong!" -ForegroundColor Green
}
else {
    Write-Host "[kanagawa] Synced. Press Ctrl+R in Antigravity (or restart) to apply. / Da dong bo, hay bam Ctrl+R trong Antigravity de ap dung." -ForegroundColor Yellow
}
