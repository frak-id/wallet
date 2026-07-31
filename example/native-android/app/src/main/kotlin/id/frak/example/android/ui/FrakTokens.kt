package id.frak.example.android.ui

import androidx.compose.material3.lightColorScheme
import androidx.compose.ui.graphics.Color

/**
 * Frak design-system colours, mirrored from
 * `packages/design-system/src/tokens.css.ts`.
 *
 * Kept as a literal transcription of the web tokens — same names, same hex
 * values — so a divergence is a visible diff rather than a judgement call.
 * Only the subset this harness renders is transcribed; add tokens here as
 * screens need them rather than inventing local colours at the call site.
 */
object FrakBrand {
    val white = Color(0xFFFFFFFF)
    val grey50 = Color(0xFFF9FAFB)
    val grey100 = Color(0xFFF7F7F7)
    val grey200 = Color(0xFFF5F5F5)
    val grey250 = Color(0xFFE2E2E2)
    val grey400 = Color(0xFFA3A3A3)
    val grey600 = Color(0xFF525252)
    val grey700 = Color(0xFF262626)
    val grey800 = Color(0xFF000000)

    val primary50 = Color(0xFFF2F6FE)
    val primary400 = Color(0xFF668EF5)
    val primary600 = Color(0xFF0043EF)
    val primary700 = Color(0xFF0036BF)

    val success400 = Color(0xFF6BD8A4)
    val success600 = Color(0xFF09BE67)

    val error400 = Color(0xFFEE7783)
    val error600 = Color(0xFFE31C31)
}

/**
 * Semantic light-theme tokens (`semanticLight` in the web token file).
 *
 * Screens reference these, never [FrakBrand] directly — the same rule the web
 * design system enforces ("semantic tokens, not raw colors").
 */
object FrakTheme {
    val textPrimary = FrakBrand.grey800
    val textSecondary = FrakBrand.grey600
    val textOnAction = FrakBrand.white
    val textAction = FrakBrand.primary600

    val surfaceBackground = FrakBrand.white
    val surfaceBackground2 = FrakBrand.grey50
    val surfacePrimary = FrakBrand.primary600
    val surfaceSecondary = FrakBrand.primary50
    val surfaceMuted = FrakBrand.grey100
    val surfaceDisabled = FrakBrand.grey250

    val borderSubtle = FrakBrand.grey200
    val borderDefault = FrakBrand.grey250

    val success = FrakBrand.success600
    val error = FrakBrand.error600

    /**
     * Log console. The web design system has no dark-console equivalent, so
     * these reuse the dark-theme surface token plus the 400-weight ramp, which
     * is the lightest step that stays legible on it.
     */
    val consoleSurface = FrakBrand.grey700
    val consoleInfo = FrakBrand.primary400
    val consoleSuccess = FrakBrand.success400
    val consoleError = FrakBrand.error400
    val consoleTimestamp = FrakBrand.grey400
}

/** Maps the semantic tokens onto the Material 3 scheme Compose expects. */
val FrakColorScheme =
    lightColorScheme(
        primary = FrakTheme.surfacePrimary,
        onPrimary = FrakTheme.textOnAction,
        primaryContainer = FrakTheme.surfaceSecondary,
        onPrimaryContainer = FrakTheme.textPrimary,
        background = FrakTheme.surfaceBackground,
        onBackground = FrakTheme.textPrimary,
        surface = FrakTheme.surfaceBackground,
        onSurface = FrakTheme.textPrimary,
        surfaceVariant = FrakTheme.surfaceBackground2,
        onSurfaceVariant = FrakTheme.textSecondary,
        outline = FrakTheme.borderDefault,
        outlineVariant = FrakTheme.borderSubtle,
        error = FrakTheme.error,
        onError = FrakTheme.textOnAction,
    )
