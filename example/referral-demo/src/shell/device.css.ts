import { createVar } from "@vanilla-extract/css";

/**
 * Insets of the phone the screens are drawn on. In the desktop frame they are
 * the simulated status bar and home indicator; full-screen on a real phone
 * they are the OS safe areas. Screens under an `app` chrome pad with these,
 * never with `env()` or the design-system `safeArea` token directly.
 */
export const deviceInset = {
    top: createVar(),
    bottom: createVar(),
};

export const fonts = {
    /** iOS chrome, Instagram, App Store. */
    system: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", "Inter", sans-serif',
    /** Maison Lune headlines. */
    serif: 'ui-serif, "New York", "Iowan Old Style", "Times New Roman", Georgia, serif',
    /** Frak surfaces: the design-system font. */
    inter: '"Inter", "Inter Fallback", sans-serif',
} as const;

/** Logical size of the simulated phone (iPhone 16 Pro). */
/** iOS light-mode system colours, shared by every mocked system sheet and browser. */
export const iosColors = {
    blue: "#007aff",
    label: "#000",
    secondaryLabel: "rgba(60, 60, 67, 0.6)",
    separator: "rgba(60, 60, 67, 0.18)",
};

export const DEVICE_WIDTH = 402;
export const DEVICE_HEIGHT = 874;
export const DEVICE_BEZEL = 12;
