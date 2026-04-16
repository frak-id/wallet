import { createGlobalTheme, globalStyle } from "@vanilla-extract/css";

/**
 * Global design tokens for the EthCC demo wallet.
 * Kept intentionally small: enough for a cohesive, modern dark UI.
 */
export const vars = createGlobalTheme(":root", {
    color: {
        background: "#0b1020",
        surface: "rgba(255, 255, 255, 0.04)",
        surfaceHover: "rgba(255, 255, 255, 0.08)",
        border: "rgba(255, 255, 255, 0.08)",
        borderStrong: "rgba(255, 255, 255, 0.16)",
        text: "#e6e9f2",
        textMuted: "#8892a8",
        accent: "#6366f1",
        accentHover: "#7c7ff3",
        danger: "#ef4444",
    },
    space: {
        xs: "4px",
        sm: "8px",
        md: "16px",
        lg: "24px",
        xl: "32px",
    },
    radius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
    },
    font: {
        body: '"Inter", "-apple-system", "BlinkMacSystemFont", system-ui, "Segoe UI", sans-serif',
    },
    shadow: {
        panel: "0 1px 2px rgba(0, 0, 0, 0.25), 0 8px 24px rgba(0, 0, 0, 0.35)",
    },
});

// Reset + base
globalStyle("*, *::before, *::after", {
    boxSizing: "border-box",
});

globalStyle("html, body", {
    margin: 0,
    padding: 0,
});

globalStyle("html", {
    fontFamily: vars.font.body,
    fontSize: "16px",
    lineHeight: 1.5,
    color: vars.color.text,
    backgroundColor: vars.color.background,
    backgroundImage: `radial-gradient(ellipse at top, rgba(99, 102, 241, 0.12), transparent 60%)`,
    backgroundAttachment: "fixed",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
});

globalStyle("body", {
    fontSize: "14px",
});

globalStyle("h1, h2, h3, h4, h5", {
    margin: 0,
    fontWeight: 600,
    letterSpacing: "-0.01em",
});

globalStyle("h1", { fontSize: "28px", marginBottom: vars.space.lg });
globalStyle("h2", { fontSize: "18px", marginBottom: vars.space.sm });
globalStyle("h4", { fontSize: "15px", marginBottom: vars.space.xs });
globalStyle("h5", {
    fontSize: "13px",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: vars.color.textMuted,
    marginBottom: vars.space.xs,
});

globalStyle("p", {
    margin: `0 0 ${vars.space.sm} 0`,
});

globalStyle("a", {
    color: vars.color.accent,
    textDecoration: "none",
    transition: "color 0.15s ease",
});

globalStyle("a:hover", {
    color: vars.color.accentHover,
});

globalStyle("hr", {
    border: "none",
    borderTop: `1px solid ${vars.color.border}`,
    margin: `${vars.space.md} 0`,
});
