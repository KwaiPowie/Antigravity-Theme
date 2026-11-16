# ============================================================================
# Kanagawa Theme installer for Antigravity 2.x (Windows)
# Bộ cài đặt Kanagawa Theme cho Antigravity 2.x (Windows)
# ============================================================================
param(
    [switch]$KillRunning,
    [switch]$SkipIde,
    [string]$Theme = "kanagawa"
)
$ErrorActionPreference = 'Stop'

$rawTheme = if ($Theme) { $Theme.Trim() } else { 'kanagawa' }
if ($rawTheme -match '^[a-zA-Z0-9_-]+$') {
    $ThemeName = if ($rawTheme -like '*-theme') { $rawTheme } else { "$rawTheme-theme" }
}
else {
    Write-Host "[kanagawa] ERROR / LOI: Invalid theme name '$Theme'. Only letters, digits, '_' and '-' are allowed." -ForegroundColor Red
    exit 1
}
$AppDir    = Join-Path $env:LOCALAPPDATA 'Programs\Antigravity'
$Resources = Join-Path $AppDir 'resources'
$Asar      = Join-Path $Resources 'app.asar'
$Backup    = Join-Path $Resources 'app.asar.pixel-backup'
$Injector  = Join-Path $PSScriptRoot 'patch\pixelTheme.js'
$ThemeSrc  = Join-Path $PSScriptRoot $ThemeName
$Work      = Join-Path $env:TEMP ('kanagawa-theme-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$NewAsar   = "$Asar.pixel-new"
$IdeOutDir = Join-Path $env:LOCALAPPDATA 'Programs\Antigravity IDE\resources\app\out'
$IdeMainJs = Join-Path $IdeOutDir 'main.js'
$IdeHookSrc = Join-Path $PSScriptRoot 'patch\ideTheme.mjs'

function Write-Step($msg) { Write-Host "[kanagawa] $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "[kanagawa] ERROR / LOI: $msg" -ForegroundColor Red; exit 1 }

if (-not (Test-Path $Asar))     { Fail "app.asar not found at $Asar / Khong tim thay app.asar." }
if (-not (Test-Path $Injector)) { Fail "patch\pixelTheme.js not found / Khong tim thay patch\pixelTheme.js." }
if (-not (Test-Path $ThemeSrc)) { Fail "$ThemeName folder not found / Khong tim thay thu muc $ThemeName." }

# --- 1. Ensure Antigravity is closed before touching app.asar ---
$procNames = @('Antigravity', 'language_server')
if (-not $SkipIde -and (Test-Path $IdeMainJs) -and (Test-Path $IdeHookSrc)) {
    $procNames += 'Antigravity IDE'
}
$procs = @(Get-Process -Name $procNames -ErrorAction SilentlyContinue)
if ($procs.Count -gt 0) {
    if ($KillRunning) {
        Write-Step "Stopping running Antigravity / Dang dong Antigravity..."
        $procs | Stop-Process -Force -Confirm:$false
        Start-Sleep -Seconds 2
    }
    else {
        Fail "Antigravity is running (check system tray). Close it or run: .\install.ps1 -KillRunning | Antigravity dang chay, hay dong han hoac chay: .\install.ps1 -KillRunning"
    }
}

# --- 2. Extract and patch app.asar if needed ---
$InstallError = $null
try {
    Write-Step "Extracting app.asar / Dang giai nen app.asar..."
    npx --yes @electron/asar extract $Asar $Work
    if ($LASTEXITCODE -ne 0) { throw "asar extract failed (is Node.js installed?) / Loi giai nen asar (kiem tra da cai Node.js chua)." }

    $UtilsPath = Join-Path $Work 'dist\utils.js'
    if (-not (Test-Path $UtilsPath)) { throw "dist/utils.js not found inside app.asar / Khong tim thay dist/utils.js." }
    $Utils = [System.IO.File]::ReadAllText($UtilsPath)

    $PackedInjector = Join-Path $Work 'dist\pixelTheme.js'
    $AlreadyPatched = $Utils.Contains('pixelTheme')
    $NeedsRepack = $false

    $HandlersPath = Join-Path $Work 'dist\ipcHandlers.js'
    $H1 = "if (win && process.platform === 'win32') {"

    if ($AlreadyPatched) {
        $expectedHooks = @(
            'pixelTheme_1.attachPixelLoadingOverlay',
            'pixelTheme_1.attachPixelTheme',
            'pixelTheme_1.chromeColors',
            'pixelTheme_1.wantsNativeCaption'
        )
        $missingHooks = @($expectedHooks | Where-Object { -not $Utils.Contains($_) })
        if ($missingHooks.Count -gt 0) {
            throw ("app.asar contains a partial pixelTheme patch (missing: " + ($missingHooks -join ', ') + "). Restore backup or reinstall Antigravity first.")
        }

        if (Test-Path $HandlersPath) {
            $Handlers = [System.IO.File]::ReadAllText($HandlersPath)
            if ($Handlers.Contains($H1)) {
                Write-Step "Patching dist/ipcHandlers.js..."
                $Handlers = $Handlers.Replace($H1, "if (win && process.platform === 'win32' && !win.__pixelNoNativeCaption) {")
                [System.IO.File]::WriteAllText($HandlersPath, $Handlers, (New-Object System.Text.UTF8Encoding($false)))
                $NeedsRepack = $true
            }
        }

        if (-not (Test-Path $Backup)) {
            Write-Step "Warning: app.asar.pixel-backup is missing (uninstall.ps1 will reverse-unpatch app.asar if needed)."
        }

        $packedHash = if (Test-Path $PackedInjector) { (Get-FileHash $PackedInjector).Hash } else { '' }
        if ($packedHash -ne (Get-FileHash $Injector).Hash) {
            Write-Step "Updating injector inside app.asar / Dang cap nhat injector trong app.asar..."
            Copy-Item $Injector $PackedInjector -Force
            $NeedsRepack = $true
        }
        elseif (-not $NeedsRepack) {
            Write-Step "app.asar up to date - refreshing theme assets / app.asar da moi nhat, chi dong bo theme..."
        }
    }
    else {
        $A1 = 'const loadingOverlay_1 = require("./loadingOverlay");'
        $A2 = '(0, loadingOverlay_1.attachLoadingOverlay)(win, foregroundColor, backgroundColor);'
        $A3 = 'void win.loadURL(url);'
        $A4 = "const backgroundColor = isLight ? '#FAFAFA' : '#131313';"
        $A5 = "const foregroundColor = isLight ? '#383A42' : '#FAFAFA';"
        $A6 = 'titleBarOverlay: isMacOS()'

        foreach ($a in @($A1, $A2, $A3, $A4, $A5, $A6)) {
            if (-not $Utils.Contains($a)) {
                throw "Patch anchor not found in utils.js ($a)."
            }
        }

        Write-Step "Patching dist/utils.js..."
        $Utils = $Utils.Replace($A1, $A1 + "`nconst pixelTheme_1 = require(`"./pixelTheme`");")
        $Utils = $Utils.Replace($A2, '(0, pixelTheme_1.attachPixelLoadingOverlay)(win, foregroundColor, backgroundColor);')
        $Utils = $Utils.Replace($A3, "(0, pixelTheme_1.attachPixelTheme)(win);`n    " + $A3)
        $Utils = $Utils.Replace($A4, "const pixelChrome_1 = (0, pixelTheme_1.chromeColors)(isLight);`n    const backgroundColor = pixelChrome_1.background;")
        $Utils = $Utils.Replace($A5, 'const foregroundColor = pixelChrome_1.foreground;')
        $Utils = $Utils.Replace($A6, 'titleBarOverlay: !(0, pixelTheme_1.wantsNativeCaption)() || isMacOS()')
        [System.IO.File]::WriteAllText($UtilsPath, $Utils, (New-Object System.Text.UTF8Encoding($false)))

        if (Test-Path $HandlersPath) {
            $Handlers = [System.IO.File]::ReadAllText($HandlersPath)
            if ($Handlers.Contains($H1)) {
                $Handlers = $Handlers.Replace($H1, "if (win && process.platform === 'win32' && !win.__pixelNoNativeCaption) {")
                [System.IO.File]::WriteAllText($HandlersPath, $Handlers, (New-Object System.Text.UTF8Encoding($false)))
            }
        }

        Copy-Item $Injector $PackedInjector -Force
        Write-Step "Backing up app.asar -> app.asar.pixel-backup"
        Copy-Item $Asar $Backup -Force
        $NeedsRepack = $true
    }

    if ($NeedsRepack) {
        Write-Step "Repacking app.asar / Dang dong goi lai app.asar..."
        npx --yes @electron/asar pack $Work $NewAsar
        if ($LASTEXITCODE -ne 0 -or -not (Test-Path $NewAsar)) { throw "asar pack failed - app.asar was NOT modified." }
        Move-Item $NewAsar $Asar -Force
    }
}
catch {
    $InstallError = $_.Exception.Message
}
finally {
    Remove-Item $Work -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
    if (Test-Path $NewAsar) {
        Remove-Item $NewAsar -Force -Confirm:$false -ErrorAction SilentlyContinue
    }
}
if ($InstallError) { Fail $InstallError }

# --- 3. Deploy $ThemeName assets ---
$ThemeDst = Join-Path $Resources $ThemeName
Write-Step "Deploying $ThemeName to $ThemeDst..."
if (Test-Path $ThemeDst) { Remove-Item $ThemeDst -Recurse -Force -Confirm:$false }
New-Item -ItemType Directory -Path $ThemeDst -Force | Out-Null
Get-ChildItem -Path $ThemeSrc -Force | Where-Object {
    $_.Name -notin @('.live-watch.json', '.ide-live-watch.json', 'repo-link.json')
} | ForEach-Object {
    Copy-Item $_.FullName -Destination (Join-Path $ThemeDst $_.Name) -Recurse -Force
}

$RepoLink = @{
    repoRoot  = $PSScriptRoot
    themeDir  = $ThemeSrc
    updatedAt = (Get-Date).ToString('o')
} | ConvertTo-Json
[System.IO.File]::WriteAllText((Join-Path $ThemeDst 'repo-link.json'), $RepoLink, (New-Object System.Text.UTF8Encoding($false)))

$ActiveConfig = @{ theme = $ThemeName } | ConvertTo-Json
$ActiveConfigPath = Join-Path $Resources 'active-theme.json'
[System.IO.File]::WriteAllText($ActiveConfigPath, $ActiveConfig, (New-Object System.Text.UTF8Encoding($false)))

# --- 4. Link Antigravity IDE (if installed) to the same shared theme ---
if (-not $SkipIde -and (Test-Path $IdeMainJs) -and (Test-Path $IdeHookSrc)) {
    Write-Step "Linking Antigravity IDE to shared $ThemeName / Dang lien ket Antigravity IDE..."
    $IdeHookDst = Join-Path $IdeOutDir 'kanagawa-ide-hook.mjs'
    $IdeMainBackup = "$IdeMainJs.pixel-backup"
    Copy-Item $IdeHookSrc $IdeHookDst -Force
    $ideMainContent = [System.IO.File]::ReadAllText($IdeMainJs)
    $ideStart = '/* === KANAGAWA-IDE-HOOK-START === */'
    $ideEnd   = '/* === KANAGAWA-IDE-HOOK-END === */'
    $ideMarker = "$ideStart import `"./kanagawa-ide-hook.mjs`"; $ideEnd"
    $hasStart = $ideMainContent.Contains($ideStart)
    $hasEnd   = $ideMainContent.Contains($ideEnd)
    $hasHook  = $ideMainContent.Contains('kanagawa-ide-hook.mjs')
    if (-not $hasHook) {
        Copy-Item $IdeMainJs $IdeMainBackup -Force
        $ideMainContent = $ideMainContent.TrimEnd() + "`n" + $ideMarker + "`n"
        [System.IO.File]::WriteAllText($IdeMainJs, $ideMainContent, (New-Object System.Text.UTF8Encoding($false)))
    }
    elseif (-not ($hasStart -and $hasEnd)) {
        $ideMainContent = [regex]::Replace($ideMainContent, '\r?\n?(?:/\* === KANAGAWA-IDE-HOOK-START === \*/)?[^\r\n]*kanagawa-ide-hook\.mjs[^\r\n]*(?:/\* === KANAGAWA-IDE-HOOK-END === \*/)?', '')
        $ideMainContent = $ideMainContent.TrimEnd() + "`n" + $ideMarker + "`n"
        [System.IO.File]::WriteAllText($IdeMainJs, $ideMainContent, (New-Object System.Text.UTF8Encoding($false)))
    }
}

Write-Host ""
Write-Host "  Kanagawa Theme installed! / Da cai dat Kanagawa Theme + Studio xong!" -ForegroundColor Green
Write-Host "  - Open Antigravity (or Antigravity IDE), then press Ctrl+Alt+K (or click Studio pill) to customize live!" -ForegroundColor White
Write-Host "  - Mo lai Antigravity (hoac Antigravity IDE) roi bam Ctrl+Alt+K de tuy bien truc tiep & dong bo ca 2 app!" -ForegroundColor Cyan
Write-Host ""
