import SwiftUI

/// Frak design-system colours, mirrored from
/// `packages/design-system/src/tokens.css.ts`.
///
/// Kept as a literal transcription of the web tokens — same names, same hex
/// values — so a divergence is a visible diff rather than a judgement call.
/// Only the subset this harness renders is transcribed; add tokens here as
/// screens need them rather than inventing local colours at the call site.
enum FrakBrand {
    static let white = Color(hex: 0xFFFFFF)
    static let grey50 = Color(hex: 0xF9FAFB)
    static let grey100 = Color(hex: 0xF7F7F7)
    static let grey200 = Color(hex: 0xF5F5F5)
    static let grey250 = Color(hex: 0xE2E2E2)
    static let grey400 = Color(hex: 0xA3A3A3)
    static let grey600 = Color(hex: 0x525252)
    static let grey700 = Color(hex: 0x262626)
    static let grey800 = Color(hex: 0x000000)

    static let primary50 = Color(hex: 0xF2F6FE)
    static let primary400 = Color(hex: 0x668EF5)
    static let primary600 = Color(hex: 0x0043EF)
    static let primary700 = Color(hex: 0x0036BF)

    static let success400 = Color(hex: 0x6BD8A4)
    static let success600 = Color(hex: 0x09BE67)

    static let error400 = Color(hex: 0xEE7783)
    static let error600 = Color(hex: 0xE31C31)
}

/// Semantic light-theme tokens (`semanticLight` in the web token file).
///
/// Views reference these, never ``FrakBrand`` directly — the same rule the web
/// design system enforces ("semantic tokens, not raw colors").
enum FrakTheme {
    static let textPrimary = FrakBrand.grey800
    static let textSecondary = FrakBrand.grey600
    static let textOnAction = FrakBrand.white
    static let textAction = FrakBrand.primary600

    static let surfaceBackground = FrakBrand.white
    static let surfaceBackground2 = FrakBrand.grey50
    static let surfacePrimary = FrakBrand.primary600
    static let surfaceSecondary = FrakBrand.primary50
    static let surfaceMuted = FrakBrand.grey100
    static let surfaceDisabled = FrakBrand.grey250

    static let borderSubtle = FrakBrand.grey200
    static let borderDefault = FrakBrand.grey250

    static let success = FrakBrand.success600
    static let error = FrakBrand.error600

    /// Log console. The web design system has no dark-console equivalent, so
    /// these reuse the dark-theme surface token plus the 400-weight ramp, which
    /// is the lightest step that stays legible on it.
    static let consoleSurface = FrakBrand.grey700
    static let consoleInfo = FrakBrand.primary400
    static let consoleSuccess = FrakBrand.success400
    static let consoleError = FrakBrand.error400
    static let consoleTimestamp = FrakBrand.grey400
}

extension Color {
    /// Builds a colour from a `0xRRGGBB` literal, so the token table above can
    /// be read side by side with the web hex values.
    init(hex: UInt32) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: 1
        )
    }
}
