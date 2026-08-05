export const brand = {
    colors: {
        neutral: {
            white: "#ffffff",
            black70: "#000000b2",
            grey50: "#f9fafb",
            grey100: "#f7f7f7",
            grey200: "#f5f5f5",
            grey250: "#e2e2e2",
            grey300: "#d4d4d4",
            grey400: "#a3a3a3",
            grey500: "#737373",
            grey600: "#525252",
            grey700: "#262626",
            grey800: "#000000",
        },
        primary: {
            50: "#f2f6fe",
            100: "#e5ecfd",
            200: "#ccd9fc",
            300: "#99b4f9",
            400: "#668ef5",
            500: "#3369f2",
            600: "#0043ef",
            700: "#0036bf",
            800: "#00288f",
        },
        success: {
            50: "#f3fcf7",
            100: "#e6f8f0",
            200: "#cef2e1",
            300: "#9de5c2",
            400: "#6bd8a4",
            500: "#3acb85",
            600: "#09be67",
            700: "#079852",
            800: "#05723e",
        },
        warning: {
            50: "#fef9f2",
            100: "#fdf2e5",
            200: "#fbe5cc",
            300: "#f7cb99",
            400: "#f4b266",
            500: "#f09833",
            600: "#ec7e00",
            700: "#bd6500",
            800: "#8e4c00",
        },
        error: {
            50: "#fef4f5",
            100: "#fce8ea",
            200: "#f9d2d6",
            300: "#f4a4ac",
            400: "#ee7783",
            500: "#e9495a",
            600: "#e31c31",
            700: "#b61627",
            800: "#88111d",
        },
    },
    scale: {
        0: "0",
        25: "1px",
        50: "2px",
        100: "4px",
        200: "8px",
        300: "12px",
        400: "16px",
        500: "20px",
        600: "24px",
        700: "28px",
        800: "32px",
        900: "36px",
        1000: "40px",
        1200: "48px",
        1300: "52px",
        1400: "56px",
        full: "9999px",
    },
    typography: {
        fontFamily: {
            inter: '"Inter", "Inter Fallback", sans-serif',
        },
        fontWeight: {
            regular: 400,
            medium: 500,
            semiBold: 600,
            bold: 700,
        },
    },
} as const;

export const alias = {
    spacing: {
        none: "0",
        xxs: "4px",
        xs: "8px",
        s: "12px",
        m: "16px",
        l: "24px",
        xl: "32px",
        xxl: "48px",
    },
    size: {
        none: "0",
        xs: "4px",
        s: "8px",
        m: "16px",
        l: "36px",
        xl: "48px",
        xxl: "56px",
    },
    cornerRadius: {
        none: "0",
        xs: "4px",
        s: "8px",
        m: "12px",
        l: "16px",
        xl: "24px",
        xxl: "32px",
        full: "9999px",
    },
    borderWidth: {
        none: "0",
        xs: "1px",
        s: "1px",
    },
    neutral: {
        50: brand.colors.neutral.grey50,
        100: brand.colors.neutral.grey100,
        200: brand.colors.neutral.grey200,
        250: brand.colors.neutral.grey250,
        300: brand.colors.neutral.grey300,
        400: brand.colors.neutral.grey400,
        500: brand.colors.neutral.grey500,
        600: brand.colors.neutral.grey600,
        700: brand.colors.neutral.grey700,
        white: brand.colors.neutral.white,
        overlay: brand.colors.neutral.black70,
        default: brand.colors.neutral.grey800,
    },
    primary: {
        50: brand.colors.primary[50],
        100: brand.colors.primary[100],
        200: brand.colors.primary[200],
        300: brand.colors.primary[300],
        400: brand.colors.primary[400],
        500: brand.colors.primary[500],
        700: brand.colors.primary[700],
        800: brand.colors.primary[800],
        default: brand.colors.primary[600],
    },
    success: {
        50: brand.colors.success[50],
        100: brand.colors.success[100],
        200: brand.colors.success[200],
        300: brand.colors.success[300],
        400: brand.colors.success[400],
        500: brand.colors.success[500],
        700: brand.colors.success[700],
        800: brand.colors.success[800],
        default: brand.colors.success[600],
    },
    warning: {
        50: brand.colors.warning[50],
        100: brand.colors.warning[100],
        200: brand.colors.warning[200],
        300: brand.colors.warning[300],
        400: brand.colors.warning[400],
        500: brand.colors.warning[500],
        700: brand.colors.warning[700],
        800: brand.colors.warning[800],
        default: brand.colors.warning[600],
    },
    error: {
        50: brand.colors.error[50],
        100: brand.colors.error[100],
        200: brand.colors.error[200],
        300: brand.colors.error[300],
        400: brand.colors.error[400],
        500: brand.colors.error[500],
        700: brand.colors.error[700],
        800: brand.colors.error[800],
        default: brand.colors.error[600],
    },
} as const;

export const semanticLight = {
    text: {
        primary: brand.colors.neutral.grey800,
        secondary: brand.colors.neutral.grey600,
        tertiary: brand.colors.neutral.grey400,
        disabled: brand.colors.neutral.grey400,
        action: brand.colors.primary[600],
        actionHover: brand.colors.primary[700],
        onAction: brand.colors.neutral.white,
        error: brand.colors.error[600],
        success: brand.colors.success[600],
        warning: brand.colors.warning[600],
    },
    surface: {
        primary: brand.colors.primary[600],
        secondary: brand.colors.primary[50],
        background: brand.colors.neutral.white,
        background2: brand.colors.neutral.grey50,
        elevated: brand.colors.neutral.white,
        muted: brand.colors.neutral.grey100,
        tertiary: brand.colors.neutral.grey100,
        overlay: brand.colors.neutral.black70,
        disabled: brand.colors.neutral.grey250,
        primaryHover: brand.colors.primary[700],
        primaryPressed: brand.colors.primary[800],
        secondaryHover: brand.colors.primary[100],
        secondaryPressed: brand.colors.primary[200],
        error: brand.colors.error[100],
        success: brand.colors.success[50],
        warning: brand.colors.warning[50],
    },
    border: {
        subtle: brand.colors.neutral.grey200,
        focus: brand.colors.neutral.grey400,
        error: brand.colors.error[600],
        success: brand.colors.success[600],
        warning: brand.colors.warning[600],
        default: brand.colors.neutral.grey250,
    },
    icon: {
        primary: brand.colors.neutral.grey800,
        secondary: brand.colors.neutral.grey600,
        tertiary: brand.colors.neutral.grey400,
        disabled: brand.colors.neutral.grey400,
        action: brand.colors.primary[600],
        actionHover: brand.colors.primary[700],
        onAction: brand.colors.neutral.white,
        error: brand.colors.error[600],
        success: brand.colors.success[600],
        warning: brand.colors.warning[600],
    },
} as const;

export const semanticDark = {
    text: {
        primary: brand.colors.neutral.white,
        secondary: brand.colors.neutral.grey100,
        tertiary: brand.colors.neutral.grey200,
        disabled: brand.colors.neutral.grey400,
        action: brand.colors.primary[400],
        actionHover: brand.colors.primary[700],
        onAction: brand.colors.neutral.white,
        error: brand.colors.error[500],
        success: brand.colors.success[600],
        warning: brand.colors.warning[600],
    },
    surface: {
        primary: brand.colors.primary[600],
        secondary: brand.colors.primary[800],
        background: brand.colors.neutral.grey800,
        background2: brand.colors.neutral.grey800,
        elevated: brand.colors.neutral.grey700,
        muted: brand.colors.neutral.grey600,
        tertiary: brand.colors.neutral.grey500,
        overlay: brand.colors.neutral.black70,
        disabled: brand.colors.neutral.grey250,
        primaryHover: brand.colors.primary[700],
        primaryPressed: brand.colors.primary[800],
        secondaryHover: brand.colors.primary[100],
        secondaryPressed: brand.colors.primary[200],
        error: brand.colors.error[700],
        success: brand.colors.success[800],
        warning: brand.colors.warning[800],
    },
    border: {
        subtle: brand.colors.neutral.grey500,
        focus: brand.colors.neutral.grey400,
        error: brand.colors.error[600],
        success: brand.colors.success[600],
        warning: brand.colors.warning[600],
        default: brand.colors.neutral.grey600,
    },
    icon: {
        primary: brand.colors.neutral.white,
        secondary: brand.colors.neutral.grey100,
        tertiary: brand.colors.neutral.grey100,
        disabled: brand.colors.neutral.grey400,
        action: brand.colors.primary[600],
        actionHover: brand.colors.primary[700],
        onAction: brand.colors.neutral.white,
        error: brand.colors.error[600],
        success: brand.colors.success[600],
        warning: brand.colors.warning[600],
    },
} as const;

export const zIndex = {
    dropdown: 100,
    sticky: 200,
    fixed: 500,
    modal: 1000,
    popover: 1100,
    toast: 9999,
} as const;

export const transition = {
    fast: "0.15s",
    base: "0.2s",
    slow: "0.3s",
} as const;

export const easing = {
    default: "ease",
    inOut: "ease-in-out",
    smooth: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    decelerate: "cubic-bezier(0.4, 0, 0.2, 1)",
} as const;

export const shadow = {
    panel: "4px 4px 4px 0 rgba(0,0,0,0.08)",
    elevated: "0 2px 8px rgba(0,0,0,0.08)",
    dialog: "0 4px 24px rgba(0,0,0,0.12)",
    /** Large drop shadow for centered modal cards on desktop. */
    overlay: "0 20px 50px rgba(0,0,0,0.35)",
    /**
     * Tight, high-contrast edge for white glyphs overlaid on imagery, keeping
     * them legible on light backgrounds. Use with `filter: drop-shadow(...)`.
     */
    iconOnImage: "0 1px 2px rgba(0,0,0,0.45)",
} as const;

/**
 * Fixed colors for always-dark frosted surfaces (e.g. in-app-browser banners):
 * identical in light and dark themes, so they bypass the `vars` contract.
 */
export const overlay = {
    scrim: "#000000cc",
    /** Subtle darkening for hover/press on any tinted surface (5% black). */
    hover: "#0000000d",
    /** Modal backdrop — 60% black (fullscreen detail overlay). */
    scrim60: "rgba(0,0,0,0.6)",
    /** Bottom-sheet backdrop — 50% black. */
    scrim50: "rgba(0,0,0,0.5)",
} as const;

/**
 * Frosted-glass surface values (e.g. the wallet bottom tab bar): fixed,
 * theme-agnostic rgba values composed under `backdrop-filter`, so they
 * bypass the `vars` contract like `overlay`/`onDark`.
 */
export const glass = {
    /** Near-transparent paint giving the compositor a surface to blur. */
    blurBase: "rgba(255,255,255,0.01)",
    /** Frosted pill fill. */
    fill: "rgba(255,255,255,0.55)",
    /** Glass edge border. */
    border: "rgba(0,0,0,0.06)",
    /** Inner glass-edge shadow. */
    innerShadow: "inset 0 0 8px rgba(0,0,0,0.06)",
    /** Active-tab indicator fill. */
    indicator: "rgba(118,118,128,0.12)",
} as const;

export const onDark = {
    text60: "#ffffff99",
    border40: "#ffffff66",
    surface10: "#ffffff1a",
    accent: "#2bb2ff",
} as const;

export const fontSize = {
    xxs: "10px",
    xs: "12px",
    s: "14px",
    m: "16px",
    l: "18px",
    xl: "20px",
    "2xl": "24px",
    "3xl": "28px",
    "4xl": "32px",
    "5xl": "40px",
    "6xl": "48px",
    "7xl": "60px",
} as const;

/**
 * Safe-area inset expressions for use in `*.css.ts` calc()/max() strings.
 *
 * On Android Tauri the WebView draws edge-to-edge but does NOT populate the CSS
 * `env(safe-area-inset-*)` values, so `safeArea.ts` mirrors the native insets
 * into `--safe-area-inset-*` custom properties on `<html>`. Always prefer the
 * var (set on Android), fall back to `env()` (iOS/web), then `0px`. Using raw
 * `env(...)` alone clips bottom content behind the Android nav bar.
 */
export const safeArea = {
    top: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
    bottom: "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
    left: "var(--safe-area-inset-left, env(safe-area-inset-left, 0px))",
    right: "var(--safe-area-inset-right, env(safe-area-inset-right, 0px))",
} as const;
