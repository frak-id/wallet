import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const legacyPanel = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    padding: alias.spacing.m,
    backgroundColor: "rgba(255, 165, 0, 0.1)",
    border: `1px solid ${vars.text.warning}`,
    borderRadius: alias.cornerRadius.s,
});

export const legacyPanelHeader = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    fontSize: "0.9375rem",
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.warning,
});

export const legacyPanelDescription = style({
    fontSize: "0.875rem",
    color: vars.text.secondary,
    lineHeight: 1.4,
    margin: 0,
});

export const legacyPanelStats = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    padding: alias.spacing.s,
    backgroundColor: vars.surface.background2,
    borderRadius: "6px",
    border: `1px solid ${vars.border.default}`,
});

export const legacyPanelStatRow = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "0.8125rem",
});

export const legacyPanelStatLabel = style({
    color: vars.text.secondary,
});

export const legacyPanelStatValue = style({
    fontWeight: brand.typography.fontWeight.semiBold,
    // TODO: token
    fontFamily: "var(--font-mono)",
    color: vars.text.primary,
});

export const legacyPanelStatValuePending = style({
    color: vars.text.warning,
});

export const legacyPanelStatValueWithdrawable = style({
    color: vars.text.success,
});

