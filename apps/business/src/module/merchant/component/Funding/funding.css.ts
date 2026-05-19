import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const bankPanel = style({
    marginBottom: "20px",
});
export const bankHeaderRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: alias.spacing.m,
    paddingBottom: alias.spacing.m,
    borderBottom: `1px solid ${vars.border.default}`,
});

export const statusToggle = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    fontSize: "0.875rem",
    color: vars.text.secondary,
});

export const statusLabel = style({
    fontWeight: brand.typography.fontWeight.medium,
});

export const tokenGrid = style({
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: alias.spacing.s,
});

export const tokenCard = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    padding: alias.spacing.m,
    border: `1px solid ${vars.border.default}`,
    borderLeft: `3px solid ${vars.border.default}`,
    borderRadius: alias.cornerRadius.s,
    backgroundColor: vars.surface.background2,
    boxShadow: "0 1px 3px rgb(0 0 0 / 0.06)",
    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
    selectors: {
        "&:hover": {
            borderColor: vars.border.focus,
            boxShadow: "0 2px 6px rgb(0 0 0 / 0.1)",
        },
    },
});

export const tokenCardEmpty = style({
    opacity: 0.5,
    selectors: {
        "&:hover": {
            borderColor: vars.border.default,
        },
    },
});

export const tokenCardActive = style({
    borderLeftColor: vars.text.success,
});

export const tokenCardWarning = style({
    borderLeftColor: vars.text.warning,
});

export const tokenCardPaused = style({
    borderLeftColor: vars.text.error,
});

export const tokenCardCurrency = style({
    fontSize: "1.125rem",
    fontWeight: brand.typography.fontWeight.bold,
    color: vars.text.primary,
});

export const tokenCardBalance = style({
    fontSize: "1.5rem",
    fontWeight: brand.typography.fontWeight.bold,
    // TODO: token (font-mono)
    fontFamily: "var(--font-mono)",
    color: vars.text.primary,
    lineHeight: 1.2,
});

export const tokenCardAvailableLabel = style({
    fontSize: "0.75rem",
    color: vars.text.secondary,
});

export const tokenCardEmptyLabel = style({
    fontSize: "0.75rem",
    color: vars.text.secondary,
    fontStyle: "italic",
});

export const tokenCardActions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    paddingTop: alias.spacing.s,
    borderTop: `1px solid ${vars.border.default}`,
});

export const tokenCardWarningBox = style({
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "0.8125rem",
    color: vars.text.warning,
    backgroundColor: "rgba(255, 165, 0, 0.1)",
    padding: "6px 10px",
    borderRadius: "6px",
});

export const actionRow = style({
    display: "flex",
    gap: alias.spacing.xs,
});

export const smallInput = style({
    width: "120px !important",
    height: "32px !important",
});

export const fundActionsRow = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    flexWrap: "wrap",
    marginTop: alias.spacing.xs,
    paddingTop: alias.spacing.m,
    borderTop: `1px dashed ${vars.border.default}`,
});

export const errorText = style({
    color: vars.text.error,
    textAlign: "center",
    padding: "20px",
});

