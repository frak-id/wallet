import { keyframes, style } from "@vanilla-extract/css";

const rise = keyframes({
    from: { opacity: 0, transform: "translateY(8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

const reducedMotion = "(prefers-reduced-motion: reduce)";
const ink = "#111827";
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
    { display: "flex", alignItems: "flex-start", gap: "8px" },
]);

export const title = style([
    box,
    { flex: 1, fontSize: "17px", fontWeight: 700, lineHeight: "22px" },
]);

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

export const breakdown = style([
    box,
    {
        listStyle: "none",
        padding: 0,
        marginTop: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
    },
]);

export const breakdownRow = style([
    box,
    {
        display: "flex",
        justifyContent: "space-between",
        fontSize: "14px",
        color: "#374151",
    },
]);

export const description = style([
    box,
    {
        marginTop: "12px",
        fontSize: "14px",
        lineHeight: "20px",
        color: "#374151",
    },
]);

export const deadline = style([
    box,
    { marginTop: "8px", fontSize: "13px", fontWeight: 600, color: "#374151" },
]);

export const deadlineUrgent = style({ color: urgent });

export const unlock = style([
    box,
    { marginTop: "4px", fontSize: "13px", color: "#6b7280" },
]);

export const actions = style([
    box,
    {
        marginTop: "16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "stretch",
        gap: "8px",
    },
]);

export const cta = style([
    control,
    {
        display: "block",
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

export const later = style([
    control,
    { padding: "8px", fontSize: "14px", color: "#6b7280" },
]);

export const qr = style([box, { margin: "16px auto 0", textAlign: "center" }]);

export const qrCaption = style([
    box,
    { marginTop: "4px", fontSize: "12px", color: "#6b7280" },
]);

// Injected at build time by vanillaExtractInlinePlugin with the
// compiled CSS string. Placeholder satisfies TypeScript.
export const cssSource: string = "";
