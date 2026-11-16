<#
.SYNOPSIS
  Quickly customize Kanagawa wallpaper (including .avif), glass/surface opacities, avatars, presets & profiles, then hot-sync Antigravity.
  Tuy bien nhanh hinh nen (ho tro .avif), do trong suot & kinh mo, avatar, preset & ho so theme roi dong bo ngay.
#>
param(
    [string]$Profile,
    [string]$SaveProfile,
    [string]$Preset,
    [string]$Wallpaper,
    [string]$WallpaperLight,
    [string]$WallpaperPosition,
    [string]$WallpaperPositionLight,
    [string]$WallpaperFit,
    [string]$ScrimStyle,
    [double]$WpBlur,
    [double]$WpBrightness,
    [double]$WpContrast,
    [double]$WpSaturate,
    [double]$WpOpacity,
    [double]$WpScale,
    [double]$ScrimOpacity,
    [double]$SidebarOpacity,
    [double]$PanelOpacity,
    [double]$ChatOpacity,
    [double]$UserBubbleOpacity,
    [double]$ComposerOpacity,
    [double]$CodeOpacity,
    [double]$EditorOpacity,
    [double]$OverlayOpacity,
    [double]$TitlebarOpacity,
    [double]$GlassBlur,
    [double]$GlassSaturate,
    [double]$PanelRadius,
    [double]$CardRadius,
    [double]$ComposerRadius,
    [double]$BubbleRadius,
    [double]$AvatarSize,
    [double]$UserAvatarSize,
    [double]$AgentAvatarSize,
    [double]$AvatarRadius,
    [double]$UserAvatarRadius,
    [double]$AgentAvatarRadius,
    [double]$AvatarRotate,
    [double]$UserAvatarRotate,
    [double]$AgentAvatarRotate,
    [string]$UserAvatar,
    [string]$AgentAvatar,
    [string]$UserAvatarVisible,
    [string]$AgentAvatarVisible,
    [string]$DarkPrimary,
    [string]$DarkBlue,
    [string]$DarkAqua,
    [string]$DarkSurface,
    [string]$DarkChrome,
    [string]$DarkSidebar,
    [string]$DarkOverlay,
    [string]$DarkScrim,
    [string]$DarkSelection,
    [string]$LightPrimary,
    [string]$LightChrome,
    [string]$LightSurface,
    [string]$UiFont,
    [string]$MonoFont,
    [double]$ChatFontSize,
    [double]$CodeFontSize,
    [double]$LineHeight,
    [string]$LoadingTitle,
    [string]$LoadingSubtitle,
    [string]$LoadingStyle,
    [string]$LoadingShowEmblem,
    [string]$LoadingShowProgress,
    [string]$StudioPill,
    [string]$StudioPillPos,
    [string]$StudioLang,
    [switch]$Help,
    [switch]$ListPresets,
    [switch]$ListProfiles,
    [switch]$SeedOnly,
    [switch]$DryRun,
    [switch]$PickWallpaper,
    [switch]$PickWallpaperLight,
    [switch]$NoWallpaper,
    [switch]$PickUserAvatar,
    [switch]$PickAgentAvatar,
    [switch]$Menu,
    [switch]$Reload,
    [switch]$NoReload
)

$ErrorActionPreference = "Stop"
$RepoRoot = $PSScriptRoot
$ApplyScript = Join-Path $RepoRoot "scripts\apply_kanagawa_config.js"
$SwitchScript = Join-Path $RepoRoot "switch-theme.ps1"

function Show-OpenImageDialog {
    param([string]$Title)
    Add-Type -AssemblyName System.Windows.Forms
    $dlg = New-Object System.Windows.Forms.OpenFileDialog
    try {
        $dlg.Title = $Title
        $dlg.RestoreDirectory = $true
        $dlg.Filter = "Images (*.png;*.jpg;*.jpeg;*.webp;*.avif;*.gif;*.svg;*.bmp)|*.png;*.jpg;*.jpeg;*.webp;*.avif;*.gif;*.svg;*.bmp|All files (*.*)|*.*"
        if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            return $dlg.FileName
        }
        return $null
    }
    finally {
        $dlg.Dispose()
    }
}

function Pick-ImageFile {
    param([string]$Title)
    if ([System.Threading.Thread]::CurrentThread.GetApartmentState() -eq [System.Threading.ApartmentState]::STA) {
        return Show-OpenImageDialog $Title
    }
    $state = [hashtable]::Synchronized(@{ Title = $Title; Result = $null; Error = $null })
    $thread = New-Object System.Threading.Thread([System.Threading.ParameterizedThreadStart]{
        param($st)
        try {
            $st.Result = Show-OpenImageDialog $st.Title
        }
        catch {
            $st.Error = $_.Exception.Message
        }
    })
    $thread.SetApartmentState([System.Threading.ApartmentState]::STA)
    $thread.IsBackground = $true
    $thread.Start($state)
    $thread.Join()
    if ($state.Error) { throw $state.Error }
    return $state.Result
}

$ExplicitOverrides = @{}

if ($Help -or $ListPresets -or $ListProfiles) {
    $queryArgs = @($ApplyScript)
    if ($Help)         { $queryArgs += "--help" }
    if ($ListPresets)  { $queryArgs += "--list-presets" }
    if ($ListProfiles) { $queryArgs += "--list-profiles" }
    & node @queryArgs
    exit $LASTEXITCODE
}

if ($PickWallpaper) {
    $picked = Pick-ImageFile "Choose Dark Wallpaper / Chon hinh nen Dark"
    if (-not $picked) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
    $Wallpaper = $picked
    $ExplicitOverrides["Wallpaper"] = $picked
}
if ($PickWallpaperLight) {
    $picked = Pick-ImageFile "Choose Light Wallpaper / Chon hinh nen Light"
    if (-not $picked) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
    $WallpaperLight = $picked
    $ExplicitOverrides["WallpaperLight"] = $picked
}
if ($PickUserAvatar) {
    $picked = Pick-ImageFile "Choose User Avatar / Chon Avatar User"
    if (-not $picked) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
    $UserAvatar = $picked
    $ExplicitOverrides["UserAvatar"] = $picked
}
if ($PickAgentAvatar) {
    $picked = Pick-ImageFile "Choose Agent/Gemini Avatar / Chon Avatar Agent"
    if (-not $picked) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
    $AgentAvatar = $picked
    $ExplicitOverrides["AgentAvatar"] = $picked
}

$PresetSurfaces = $null
if ($Menu) {
    Write-Host ""
    Write-Host "=== Kanagawa Theme Customizer / Tuy bien theme ===" -ForegroundColor Cyan
    Write-Host "  (Tip: Bam Ctrl+Alt+K trong Antigravity de mo Theme Studio truc quan!)" -ForegroundColor DarkGray
    Write-Host "  [1] Doi hinh nen Dark (.png/.jpg/.webp/.avif)"
    Write-Host "  [2] Doi hinh nen Light (chon anh hoac SAME/NONE)"
    Write-Host "  [3] Doi Avatar User"
    Write-Host "  [4] Doi Avatar Agent"
    Write-Host "  [5] Doi nhanh bang mau Preset"
    Write-Host "  [6] Chuyen Profile combo da luu"
    Write-Host "  [7] Chinh nhanh muc kinh mo & do trong suot (Glass / Balanced / Clear)"
    Write-Host "  [8] Ap dung tu kanagawa.config.json & dong bo"
    Write-Host "  [9] Tat hinh nen (nen tron theo mau theme)"
    Write-Host ""
    $choice = ([string](Read-Host "Select / Chon (1-9)")).Trim()
    switch ($choice) {
        "1" {
            $Wallpaper = Pick-ImageFile "Choose Dark Wallpaper / Chon hinh nen Dark"
            if (-not $Wallpaper) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
            $ExplicitOverrides["Wallpaper"] = $Wallpaper
        }
        "2" {
            $sub = ([string](Read-Host "Nhap SAME, NONE, hoac Enter de chon file anh")).Trim()
            if ($sub -match '^(SAME|NONE)$') {
                $WallpaperLight = $sub.ToUpper()
            } else {
                $WallpaperLight = Pick-ImageFile "Choose Light Wallpaper / Chon hinh nen Light"
                if (-not $WallpaperLight) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
            }
            $ExplicitOverrides["WallpaperLight"] = $WallpaperLight
        }
        "3" {
            $UserAvatar = Pick-ImageFile "Choose User Avatar / Chon Avatar User"
            if (-not $UserAvatar) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
            $ExplicitOverrides["UserAvatar"] = $UserAvatar
        }
        "4" {
            $AgentAvatar = Pick-ImageFile "Choose Agent/Gemini Avatar / Chon Avatar Agent"
            if (-not $AgentAvatar) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
            $ExplicitOverrides["AgentAvatar"] = $AgentAvatar
        }
        "5" {
            Write-Host "Available presets / Bang mau hien co:" -ForegroundColor Yellow
            & node $ApplyScript --list-presets
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            $Preset = ([string](Read-Host "Enter preset name / Nhap ten preset")).Trim()
            if (-not $Preset) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
            $ExplicitOverrides["Preset"] = $Preset
        }
        "6" {
            Write-Host "Available profiles / Ho so hien co:" -ForegroundColor Yellow
            & node $ApplyScript --list-profiles
            if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
            $Profile = ([string](Read-Host "Enter profile ID / Nhap ID profile")).Trim()
            if (-not $Profile) { Write-Host "[kanagawa] Cancelled / Da huy."; exit 0 }
            $ExplicitOverrides["Profile"] = $Profile
        }
        "7" {
            Write-Host "  [a] Clear Wallpaper (trong suot nhe, thay ro anh nen)"
            Write-Host "  [b] Balanced Glass (can bang chu ro & thay nen)"
            Write-Host "  [c] Frosted Heavy (kinh mo manh + scrim toi hon)"
            $gChoice = ([string](Read-Host "Select / Chon (a/b/c)")).Trim().ToLower()
            switch ($gChoice) {
                "a" { $PresetSurfaces = @("--panel-opacity=28", "--chat-opacity=24", "--glass-blur=6", "--scrim-opacity=36") }
                "b" { $PresetSurfaces = @("--panel-opacity=44", "--chat-opacity=36", "--glass-blur=12", "--scrim-opacity=56") }
                "c" { $PresetSurfaces = @("--panel-opacity=68", "--chat-opacity=54", "--glass-blur=18", "--scrim-opacity=72") }
                default { Write-Host "Invalid choice."; exit 1 }
            }
        }
        "8" { }
        "9" { $NoWallpaper = $true }
        default { Write-Host "Invalid choice / Lua chon khong hop le."; exit 1 }
    }
}

$StringFlagMap = [ordered]@{
    Profile                = "--profile"
    Preset                 = "--preset"
    WallpaperLight         = "--wallpaper-light"
    WallpaperPosition      = "--wallpaper-pos"
    WallpaperPositionLight = "--wallpaper-pos-light"
    WallpaperFit           = "--wallpaper-fit"
    ScrimStyle             = "--scrim-style"
    UserAvatar             = "--user-avatar"
    AgentAvatar            = "--agent-avatar"
    UserAvatarVisible      = "--user-avatar-visible"
    AgentAvatarVisible     = "--agent-avatar-visible"
    DarkPrimary            = "--dark-primary"
    DarkBlue               = "--dark-blue"
    DarkAqua               = "--dark-aqua"
    DarkSurface            = "--dark-surface"
    DarkChrome             = "--dark-chrome"
    DarkSidebar            = "--dark-sidebar"
    DarkOverlay            = "--dark-overlay"
    DarkScrim              = "--dark-scrim"
    DarkSelection          = "--dark-selection"
    LightPrimary           = "--light-primary"
    LightChrome            = "--light-chrome"
    LightSurface           = "--light-surface"
    UiFont                 = "--ui-font"
    MonoFont               = "--mono-font"
    LoadingTitle           = "--loading-title"
    LoadingSubtitle        = "--loading-subtitle"
    LoadingStyle           = "--loading-style"
    LoadingShowEmblem      = "--loading-show-emblem"
    LoadingShowProgress    = "--loading-show-progress"
    StudioPill             = "--studio-pill"
    StudioPillPos          = "--studio-pill-pos"
    StudioLang             = "--studio-lang"
    SaveProfile            = "--save-profile"
}

$NumericFlagMap = [ordered]@{
    WpBlur            = "--wp-blur"
    WpBrightness      = "--wp-brightness"
    WpContrast        = "--wp-contrast"
    WpSaturate        = "--wp-saturate"
    WpOpacity         = "--wp-opacity"
    WpScale           = "--wp-scale"
    ScrimOpacity      = "--scrim-opacity"
    SidebarOpacity    = "--sidebar-opacity"
    PanelOpacity      = "--panel-opacity"
    ChatOpacity       = "--chat-opacity"
    UserBubbleOpacity = "--user-bubble-opacity"
    ComposerOpacity   = "--composer-opacity"
    CodeOpacity       = "--code-opacity"
    EditorOpacity     = "--editor-opacity"
    OverlayOpacity    = "--overlay-opacity"
    TitlebarOpacity   = "--titlebar-opacity"
    GlassBlur         = "--glass-blur"
    GlassSaturate     = "--glass-saturate"
    PanelRadius       = "--panel-radius"
    CardRadius        = "--card-radius"
    ComposerRadius    = "--composer-radius"
    BubbleRadius      = "--bubble-radius"
    AvatarSize        = "--avatar-size"
    UserAvatarSize    = "--user-avatar-size"
    AgentAvatarSize   = "--agent-avatar-size"
    AvatarRadius      = "--avatar-radius"
    UserAvatarRadius  = "--user-avatar-radius"
    AgentAvatarRadius = "--agent-avatar-radius"
    AvatarRotate      = "--avatar-rotate"
    UserAvatarRotate  = "--user-avatar-rotate"
    AgentAvatarRotate = "--agent-avatar-rotate"
    ChatFontSize      = "--chat-font-size"
    CodeFontSize      = "--code-font-size"
    LineHeight        = "--line-height"
}

$nodeArgs = @($ApplyScript)
if ($SeedOnly)    { $nodeArgs += "--seed-only" }
if ($DryRun)      { $nodeArgs += "--dry-run" }
if ($NoWallpaper) { $nodeArgs += "--no-wallpaper" }
elseif ($ExplicitOverrides.ContainsKey("Wallpaper")) {
    $nodeArgs += ("--wallpaper=" + $ExplicitOverrides["Wallpaper"])
}
elseif ($PSBoundParameters.ContainsKey("Wallpaper")) {
    $nodeArgs += ("--wallpaper=" + $Wallpaper)
}

foreach ($entry in $StringFlagMap.GetEnumerator()) {
    $k = $entry.Key
    $flag = $entry.Value
    if ($ExplicitOverrides.ContainsKey($k)) {
        $nodeArgs += ($flag + "=" + $ExplicitOverrides[$k])
    }
    elseif ($PSBoundParameters.ContainsKey($k)) {
        $val = Get-Variable -Name $k -ValueOnly
        $nodeArgs += ($flag + "=" + [string]$val)
    }
}

foreach ($entry in $NumericFlagMap.GetEnumerator()) {
    $k = $entry.Key
    $flag = $entry.Value
    if ($PSBoundParameters.ContainsKey($k)) {
        $val = [double](Get-Variable -Name $k -ValueOnly)
        $nodeArgs += ($flag + "=" + $val.ToString([System.Globalization.CultureInfo]::InvariantCulture))
    }
}

if ($PresetSurfaces) { $nodeArgs += $PresetSurfaces }

& node @nodeArgs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not $DryRun -and -not $NoReload) {
    if ($Reload) { & $SwitchScript kanagawa -ForceReload }
    else { & $SwitchScript kanagawa }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
