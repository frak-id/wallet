import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const legacyPanel = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    padding: alias.spacing.m,
    backgroundColor: vars.surface.warning,
    border: `1px solid ${vars.border.warning}`,
    borderRadius: alias.cornerRadius.m,
});

export const legacyPanelHeader = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    fontSize: fontSize.s,
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.warning,
});

export const legacyPanelDescription = style({
    margin: 0,
    fontSize: fontSize.xs,
    color: vars.text.secondary,
    lineHeight: 1.4,
});

export const legacyPanelStats = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    padding: alias.spacing.s,
    backgroundColor: vars.surface.background,
    borderRadius: alias.cornerRadius.s,
    border: `1px solid ${vars.border.subtle}`,
});

export const legacyPanelStatRow = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: fontSize.xs,
});

export const legacyPanelStatLabel = style({
    color: vars.text.secondary,
});

export const legacyPanelStatValue = style({
    fontWeight: brand.typography.fontWeight.semiBold,
    color: vars.text.primary,
});

export const legacyPanelStatValuePending = style({
    color: vars.text.warning,
});

export const legacyPanelStatValueWithdrawable = style({
    color: vars.text.success,
});
