# ============================================================================
# Kanagawa Theme uninstaller / Go cai dat Kanagawa Theme
# ============================================================================
param(
    [switch]$KillRunning
)
$ErrorActionPreference = 'Stop'

$AppDir    = Join-Path $env:LOCALAPPDATA 'Programs\Antigravity'
$Resources = Join-Path $AppDir 'resources'
$Asar      = Join-Path $Resources 'app.asar'
$Backup    = Join-Path $Resources 'app.asar.pixel-backup'

function Write-Step($msg) { Write-Host "[kanagawa] $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "[kanagawa] ERROR / LOI: $msg" -ForegroundColor Red; exit 1 }

$procs = @(Get-Process -Name 'Antigravity', 'Antigravity IDE', 'language_server' -ErrorAction SilentlyContinue)
if ($procs.Count -gt 0) {
    if ($KillRunning) {
        Write-Step "Stopping running Antigravity / Dang dong Antigravity..."
        $procs | Stop-Process -Force -Confirm:$false
        Start-Sleep -Seconds 2
    }
    else {
        Fail "Antigravity is running. Close it or run: .\uninstall.ps1 -KillRunning | Antigravity dang chay, hay dong han hoac chay: .\uninstall.ps1 -KillRunning"
    }
}

if (Test-Path $Backup) {
    Write-Step "Restoring original app.asar / Dang khoi phuc app.asar goc..."
    Copy-Item $Backup $Asar -Force
    Remove-Item $Backup -Force -Confirm:$false
}
elseif (Test-Path $Asar) {
    Write-Step "No backup found (app.asar.pixel-backup). Inspecting app.asar / Dang kiem tra app.asar..."
    $Work = Join-Path $env:TEMP ('kanagawa-uninstall-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    $NewAsar = "$Asar.pixel-unpatch"
    $UnpatchError = $null
    try {
        npx --yes @electron/asar extract $Asar $Work
        if ($LASTEXITCODE -ne 0) { throw "asar extract failed (is Node.js installed?) / Loi giai nen asar." }

        $UtilsPath = Join-Path $Work 'dist\utils.js'
        $HandlersPath = Join-Path $Work 'dist\ipcHandlers.js'
        $PackedInjector = Join-Path $Work 'dist\pixelTheme.js'
        $Modified = $false

        if (Test-Path $UtilsPath) {
            $Utils = [System.IO.File]::ReadAllText($UtilsPath)
            if ($Utils.Contains('pixelTheme')) {
                Write-Step "Reverse-unpatching dist/utils.js / Dang go patch trong dist/utils.js..."
                $Utils = [regex]::Replace($Utils, '\r?\n[ \t]*const pixelTheme_1 = require\(["'']\./pixelTheme["'']\);', '')
                $Utils = $Utils.Replace('(0, pixelTheme_1.attachPixelLoadingOverlay)(win, foregroundColor, backgroundColor);', '(0, loadingOverlay_1.attachLoadingOverlay)(win, foregroundColor, backgroundColor);')
                $Utils = [regex]::Replace($Utils, '[ \t]*\(0, pixelTheme_1\.attachPixelTheme\)\(win\);\r?\n', '')
                $Utils = [regex]::Replace($Utils, 'const pixelChrome_1 = \(0, pixelTheme_1\.chromeColors\)\(isLight\);\r?\n[ \t]*const backgroundColor = pixelChrome_1\.background;', "const backgroundColor = isLight ? '#FAFAFA' : '#131313';")
                $Utils = $Utils.Replace('const foregroundColor = pixelChrome_1.foreground;', "const foregroundColor = isLight ? '#383A42' : '#FAFAFA';")
                $Utils = $Utils.Replace('titleBarOverlay: !(0, pixelTheme_1.wantsNativeCaption)() || isMacOS()', 'titleBarOverlay: isMacOS()')

                if ($Utils.Contains('pixelTheme')) {
                    throw "app.asar still contains unremovable pixelTheme references in dist/utils.js. Reinstall Antigravity to restore stock."
                }
                [System.IO.File]::WriteAllText($UtilsPath, $Utils, (New-Object System.Text.UTF8Encoding($false)))
                $Modified = $true
            }
        }

        if (Test-Path $HandlersPath) {
            $Handlers = [System.IO.File]::ReadAllText($HandlersPath)
            if ($Handlers.Contains('__pixelNoNativeCaption')) {
                $Handlers = $Handlers.Replace("if (win && process.platform === 'win32' && !win.__pixelNoNativeCaption) {", "if (win && process.platform === 'win32') {")
                if ($Handlers.Contains('__pixelNoNativeCaption')) {
                    throw "app.asar still contains __pixelNoNativeCaption in dist/ipcHandlers.js."
                }
                [System.IO.File]::WriteAllText($HandlersPath, $Handlers, (New-Object System.Text.UTF8Encoding($false)))
                $Modified = $true
            }
        }

        if (Test-Path $PackedInjector) {
            Remove-Item $PackedInjector -Force -Confirm:$false
            $Modified = $true
        }

        if ($Modified) {
            Write-Step "Repacking stock app.asar / Dang dong goi lai app.asar goc..."
            npx --yes @electron/asar pack $Work $NewAsar
            if ($LASTEXITCODE -ne 0 -or -not (Test-Path $NewAsar)) { throw "asar pack failed while reverse-unpatching app.asar." }
            Move-Item $NewAsar $Asar -Force
        }
        else {
            Write-Step "app.asar is already stock (no pixelTheme patch found). / app.asar da o trang thai mac dinh."
        }
    }
    catch {
        $UnpatchError = $_.Exception.Message
    }
    finally {
        Remove-Item $Work -Recurse -Force -Confirm:$false -ErrorAction SilentlyContinue
        if (Test-Path $NewAsar) {
            Remove-Item $NewAsar -Force -Confirm:$false -ErrorAction SilentlyContinue
        }
    }
    if ($UnpatchError) { Fail $UnpatchError }
}
else {
    Write-Step "app.asar not found at $Asar. / Khong tim thay app.asar."
}

$ActiveConfigPath = Join-Path $Resources 'active-theme.json'
$ExtraThemeName = $null
if (Test-Path $ActiveConfigPath) {
    try {
        $ac = Get-Content $ActiveConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($ac.theme -and $ac.theme -match '^[a-zA-Z0-9_-]+$' -and $ac.theme -ne 'kanagawa-theme' -and $ac.theme -ne 'app') {
            $ExtraThemeName = $ac.theme
        }
    } catch {}
    Remove-Item $ActiveConfigPath -Force -Confirm:$false
}

$ThemeDst = Join-Path $Resources 'kanagawa-theme'
if (Test-Path $ThemeDst) {
    Write-Step "Removing kanagawa-theme assets / Dang xoa thu muc kanagawa-theme..."
    Remove-Item $ThemeDst -Recurse -Force -Confirm:$false
}
if ($ExtraThemeName) {
    $ExtraDst = Join-Path $Resources $ExtraThemeName
    if (Test-Path $ExtraDst) {
        Write-Step "Removing $ExtraThemeName assets / Dang xoa thu muc $ExtraThemeName..."
        Remove-Item $ExtraDst -Recurse -Force -Confirm:$false
    }
}

# --- Restore Antigravity IDE (if patched) ---
$IdeOutDir = Join-Path $env:LOCALAPPDATA 'Programs\Antigravity IDE\resources\app\out'
$IdeMainJs = Join-Path $IdeOutDir 'main.js'
$IdeMainBackup = "$IdeMainJs.pixel-backup"
$IdeHookDst = Join-Path $IdeOutDir 'kanagawa-ide-hook.mjs'
if (Test-Path $IdeMainBackup) {
    Write-Step "Restoring Antigravity IDE main.js / Dang khoi phuc Antigravity IDE..."
    Copy-Item $IdeMainBackup $IdeMainJs -Force
    Remove-Item $IdeMainBackup -Force -Confirm:$false
}
elseif (Test-Path $IdeMainJs) {
    $ideMainContent = [System.IO.File]::ReadAllText($IdeMainJs)
    if ($ideMainContent.Contains('kanagawa-ide-hook.mjs')) {
        Write-Step "Removing hook from Antigravity IDE main.js / Dang go hook khoi Antigravity IDE..."
        $ideMainContent = [regex]::Replace($ideMainContent, '\r?\n/\* === KANAGAWA-IDE-HOOK-START === \*/[\s\S]*?/\* === KANAGAWA-IDE-HOOK-END === \*/\r?\n?', "`n")
        [System.IO.File]::WriteAllText($IdeMainJs, $ideMainContent, (New-Object System.Text.UTF8Encoding($false)))
    }
}
if (Test-Path $IdeHookDst) {
    Remove-Item $IdeHookDst -Force -Confirm:$false
}

Write-Step "Done! Antigravity restored to stock. / Hoan tat! Antigravity da tro ve mac dinh."
