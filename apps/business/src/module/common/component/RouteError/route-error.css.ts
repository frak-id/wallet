import { alias, brand } from "@frak-labs/design-system/tokens";
import { vars } from "@frak-labs/design-system/theme";
import { keyframes, style } from "@vanilla-extract/css";

const fadeIn = keyframes({
    from: { opacity: 0, transform: "translateY(-8px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const routeError = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    padding: "2rem",
});

export const content = style({
    maxWidth: "560px",
    textAlign: "center",
    background: vars.surface.elevated,
    border: `1px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.m,
    padding: "2.5rem 2rem",
    boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)",
    animation: `${fadeIn} 0.3s ease-in-out`,
    outline: "none",
    ":focus": {
        outline: `2px solid ${vars.border.default}`,
        outlineOffset: "2px",
    },
});

export const icon = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "1rem",
    color: brand.colors.warning[500],
});

export const title = style({
    fontSize: "1.25rem",
    fontWeight: 600,
    marginBottom: "0.5rem",
    color: vars.text.primary,
});

export const message = style({
    fontSize: "0.9375rem",
    color: vars.text.secondary,
    marginBottom: "1.75rem",
    lineHeight: 1.5,
});

export const details = style({
    marginBottom: "1.5rem",
    textAlign: "left",
    backgroundColor: vars.surface.muted,
    border: `1px solid ${vars.border.subtle}`,
    borderRadius: alias.cornerRadius.s,
    padding: "1rem",
});

export const detailsSummary = style({
    cursor: "pointer",
    fontWeight: 500,
    fontSize: "0.875rem",
    color: vars.text.secondary,
    userSelect: "none",
    ":hover": {
        color: vars.text.primary,
    },
});

export const stack = style({
    marginTop: "0.75rem",
    padding: "0.75rem",
    backgroundColor: vars.surface.elevated,
    borderRadius: "6px",
    overflowX: "auto",
    fontSize: "0.75rem",
    lineHeight: 1.5,
    color: vars.text.secondary,
    fontFamily:
        '"SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace',
});

export const actions = style({
    display: "flex",
    gap: "0.75rem",
    justifyContent: "center",
    flexWrap: "wrap",
});
