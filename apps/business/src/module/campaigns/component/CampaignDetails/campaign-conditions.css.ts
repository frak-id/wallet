import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const conditionsItem = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    flexWrap: "wrap",
    padding: `${alias.spacing.xs} ${alias.spacing.s}`,
    background: brand.colors.neutral.grey50,
    border: `1px solid ${brand.colors.neutral.grey250}`,
    borderRadius: alias.cornerRadius.s,
    fontSize: "14px",
});

export const conditionsGroup = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    padding: alias.spacing.s,
    background: brand.colors.neutral.grey50,
    border: `1px solid ${brand.colors.neutral.grey250}`,
    borderRadius: alias.cornerRadius.s,
});

export const conditionsLogic = style({
    fontWeight: brand.typography.fontWeight.semiBold,
    fontSize: "13px",
    color: brand.colors.neutral.grey700,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
});

export const conditionsGroupItems = style({
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    paddingLeft: alias.spacing.s,
    borderLeft: `2px solid ${brand.colors.neutral.grey250}`,
});
