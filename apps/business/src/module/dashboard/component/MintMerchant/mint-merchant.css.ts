import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { globalStyle, style } from "@vanilla-extract/css";

export const verifySection = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

globalStyle(`${verifySection} p`, {
    margin: 0,
});

export const productSummary = style({
    backgroundColor: vars.surface.muted,
    border: `1px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.s,
    padding: alias.spacing.m,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
});

export const summaryLabel = style({
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
    minWidth: "120px",
});

export const successSection = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

globalStyle(`${successSection} p`, {
    margin: 0,
});

export const panel = style({
    transition: "opacity 0.3s ease, filter 0.3s ease",
});

export const disabledContent = style({
    padding: alias.spacing.m,
    textAlign: "center",
    color: vars.text.secondary,
    fontStyle: "italic",
});

export const lockedContent = style({
    padding: alias.spacing.m,
    color: vars.text.success,
    fontWeight: brand.typography.fontWeight.medium,
    selectors: {
        "&::before": {
            content: '"✓ "',
            color: vars.text.success,
            fontWeight: "bold",
        },
    },
});

export const nameField = style({
    margin: 0,
});

export const currencyField = style({
    margin: 0,
});

export const currencyDescription = style({
    fontSize: "13px",
    color: vars.text.secondary,
    margin: "4px 0 8px 0",
    fontStyle: "italic",
    lineHeight: 1.3,
});

export const domainSection = style({
    border: `1px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.s,
    padding: alias.spacing.l,
    backgroundColor: vars.surface.muted,
});

export const domainFields = style({
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: alias.spacing.m,
    margin: "16px 0",
    "@media": {
        "screen and (max-width: 768px)": {
            gridTemplateColumns: "1fr",
        },
    },
});

export const domainField = style({
    margin: 0,
});

export const setupCodeField = style({
    margin: 0,
});

export const domainValidIcon = style({
    position: "absolute",
    right: alias.spacing.s,
    color: "#10b981",
    pointerEvents: "none",
});

export const domainInvalidIcon = style({
    position: "absolute",
    right: alias.spacing.s,
    color: "#ef4444",
    pointerEvents: "none",
});

export const continueSection = style({
    display: "flex",
    justifyContent: "flex-end",
    gap: alias.spacing.xs,
    "@media": {
        "screen and (max-width: 768px)": {
            justifyContent: "center",
        },
    },
});

export const dnsSection = style({
    marginTop: alias.spacing.l,
    paddingTop: alias.spacing.m,
    borderTop: `1px solid ${vars.border.default}`,
});

export const dnsRecord = style({
    backgroundColor: vars.surface.background,
    border: `1px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.xs,
    padding: alias.spacing.s,
    fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
    fontSize: "13px",
    overflowX: "auto",
    margin: "8px 0",
});

export const dnsHelpAccordion = style({
    marginTop: alias.spacing.m,
});

export const dnsHelpTrigger = style({
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
    cursor: "pointer",
});

export const dnsHelpContent = style({
    fontSize: "14px",
    lineHeight: 1.6,
});

globalStyle(`${dnsHelpContent} p`, {
    margin: "8px 0",
});

export const dnsHelpLink = style({
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    color: vars.text.action,
    fontWeight: brand.typography.fontWeight.medium,
    textDecoration: "none",
    transition: "opacity 0.2s ease",
    selectors: {
        "&:hover": {
            opacity: 0.8,
            textDecoration: "underline",
        },
    },
});
