import { keyframes, style } from "@vanilla-extract/css";

const rise = keyframes({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

const wiggle = keyframes({
    "0%, 100%": { transform: "rotate(0)" },
    "25%": { transform: "rotate(-12deg)" },
    "50%": { transform: "rotate(10deg)" },
    "75%": { transform: "rotate(-5deg)" },
});

const pop = keyframes({
    from: { opacity: 0, transform: "scale(0.6)" },
    to: { opacity: 1, transform: "scale(1)" },
});

const reducedMotion = "(prefers-reduced-motion: reduce)";
const ink = "#111827";
const muted = "#6b7280";
const urgent = "#b42318";

const box = style({
    boxSizing: "border-box",
    margin: 0,
    fontFamily:
        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    textTransform: "none",
    letterSpacing: "normal",
    fontStyle: "normal",
    wordSpacing: "normal",
});

const control = style([
    box,
    {
        appearance: "none",
        border: 0,
        background: "none",
        color: "inherit",
        cursor: "pointer",
        selectors: {
            "&:focus-visible": {
                outline: "2px solid #2563eb",
                outlineOffset: "2px",
            },
        },
    },
]);

export const root = style([
    box,
    {
        position: "fixed",
        bottom: "var(--frak-reminder-bottom, 20px)",
        zIndex: 2000000,
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        maxWidth: "calc(100vw - 32px)",
    },
]);

export const sideLeft = style({ left: "16px", alignItems: "flex-start" });
export const sideRight = style({ right: "16px", alignItems: "flex-end" });

export const pillRow = style([
    box,
    {
        display: "flex",
        alignItems: "center",
        borderRadius: "999px",
        backgroundColor: ink,
        color: "#fff",
        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)",
        animation: `${rise} 300ms ease-out`,
        "@media": { [reducedMotion]: { animation: "none" } },
    },
]);

export const pillRowUrgent = style({ backgroundColor: urgent });

export const pill = style([
    control,
    {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "8px 4px 8px 12px",
        borderRadius: "999px",
        fontSize: "14px",
        lineHeight: "18px",
        textAlign: "left",
    },
]);

export const icon = style({ width: "22px", height: "22px", flexShrink: 0 });

export const pillAmount = style({ fontWeight: 700, whiteSpace: "nowrap" });

export const pillCountdown = style({
    fontSize: "12px",
    opacity: 0.9,
    whiteSpace: "nowrap",
});

export const dismiss = style([
    control,
    {
        width: "28px",
        height: "28px",
        marginRight: "6px",
        borderRadius: "50%",
        fontSize: "18px",
        lineHeight: "28px",
        opacity: 0.8,
        selectors: { "&:hover": { opacity: 1 } },
    },
]);

export const card = style([
    box,
    {
        width: "min(360px, calc(100vw - 32px))",
        padding: "16px",
        borderRadius: "16px",
        backgroundColor: "#fff",
        color: ink,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.25)",
        animation: `${rise} 200ms ease-out`,
        "@media": { [reducedMotion]: { animation: "none" } },
        selectors: { "&:focus": { outline: "none" } },
    },
]);

export const cardHeader = style([
    box,
    { display: "flex", alignItems: "center", gap: "8px" },
]);

export const eyebrow = style([
    box,
    {
        flex: 1,
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "14px",
        fontWeight: 600,
        lineHeight: "18px",
        color: "#374151",
    },
]);

export const eyebrowIcon = style({
    width: "22px",
    height: "22px",
    flexShrink: 0,
    transformOrigin: "50% 80%",
    animation: `${wiggle} 700ms 220ms ease-in-out both`,
    "@media": { [reducedMotion]: { animation: "none" } },
});

export const head = style([
    box,
    {
        marginTop: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
    },
]);

export const amount = style([
    box,
    {
        fontSize: "40px",
        lineHeight: "44px",
        fontWeight: 800,
        letterSpacing: "-0.02em",
        fontVariantNumeric: "tabular-nums",
    },
]);

export const breakdown = style([
    box,
    { marginTop: "4px", fontSize: "14px", lineHeight: "18px", color: muted },
]);

export const tile = style([
    box,
    {
        flexShrink: 0,
        minWidth: "64px",
        height: "64px",
        padding: "0 8px",
        borderRadius: "14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#fff8b8",
        color: ink,
        textAlign: "center",
        animation: `${pop} 420ms 200ms cubic-bezier(0.3, 1.6, 0.5, 1) both`,
        "@media": { [reducedMotion]: { animation: "none" } },
    },
]);

export const tileUrgent = style({
    backgroundColor: "#fce8ea",
    color: urgent,
});

export const tileNumber = style({
    fontSize: "26px",
    lineHeight: "28px",
    fontWeight: 800,
    fontVariantNumeric: "tabular-nums",
});

export const tileWord = style({
    fontSize: "18px",
    lineHeight: "22px",
    fontWeight: 800,
});

export const tileUnit = style({
    marginTop: "2px",
    fontSize: "11px",
    lineHeight: "13px",
    fontWeight: 600,
    whiteSpace: "nowrap",
});

export const close = style([
    control,
    {
        width: "28px",
        height: "28px",
        flexShrink: 0,
        borderRadius: "50%",
        fontSize: "20px",
        lineHeight: "28px",
        color: "#6b7280",
    },
]);

export const deadline = style([
    box,
    { marginTop: "10px", fontSize: "13px", lineHeight: "18px", color: muted },
]);

export const deadlineUrgent = style({ color: urgent, fontWeight: 600 });

export const cta = style([
    control,
    {
        display: "block",
        marginTop: "14px",
        padding: "12px 16px",
        borderRadius: "999px",
        backgroundColor: ink,
        color: "#fff",
        fontSize: "15px",
        fontWeight: 700,
        textAlign: "center",
        textDecoration: "none",
    },
]);

export const free = style([
    box,
    {
        marginTop: "8px",
        fontSize: "12px",
        lineHeight: "16px",
        color: muted,
        textAlign: "center",
    },
]);

export const footer = style([
    box,
    {
        marginTop: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
    },
]);

export const footerQr = style([
    box,
    {
        marginTop: "12px",
        paddingTop: "12px",
        borderTop: "1px solid #f0efed",
        justifyContent: "flex-start",
    },
]);

export const footerQrExpanded = style([
    box,
    { flexDirection: "column", gap: "6px", textAlign: "center" },
]);

export const qrButton = style([
    control,
    {
        flexShrink: 0,
        padding: 0,
        borderRadius: "6px",
        lineHeight: 0,
        cursor: "zoom-in",
    },
]);

export const qrButtonExpanded = style({ cursor: "zoom-out" });

export const qrImage = style({
    display: "block",
    width: "64px",
    height: "64px",
    transition: "width 200ms ease-out, height 200ms ease-out",
    "@media": { [reducedMotion]: { transition: "none" } },
});

// 200px is the scan floor InstallQr sizes for; the thumbnail is only a handle.
export const qrImageExpanded = style({ width: "200px", height: "200px" });

export const qrPlaceholder = style([
    box,
    {
        flexShrink: 0,
        width: "64px",
        height: "64px",
        borderRadius: "6px",
        backgroundColor: "#f3f4f6",
    },
]);

export const qrHint = style([
    box,
    { flex: 1, fontSize: "13px", lineHeight: "17px", color: "#4b5563" },
]);

export const qrHintExpanded = style({ flex: "none" });

export const later = style([
    control,
    { flexShrink: 0, padding: "8px", fontSize: "14px", color: muted },
]);

// Injected at build time by vanillaExtractInlinePlugin with the
// compiled CSS string. Placeholder satisfies TypeScript.
export const cssSource: string = "";
