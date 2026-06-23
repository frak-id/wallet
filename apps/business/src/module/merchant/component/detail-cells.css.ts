import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Read-only detail cells (label left, value right) shared by the merchant
 * Edit page cards and sheets.
 */

export const detailCells = style({
    borderRadius: alias.cornerRadius.m,
    overflow: "hidden",
});

export const detailCell = style({
    display: "flex",
    alignItems: "center",
    height: "49px",
    paddingInline: alias.spacing.m,
    gap: alias.spacing.m,
    fontSize: fontSize.s,
});

export const cellLabel = style({
    flex: 1,
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
    lineHeight: "22px",
});

export const cellValue = style({
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.primary,
    lineHeight: "22px",
    textAlign: "right",
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

/** Color for the success state value — layout comes from `Inline`. */
export const statusSuccess = style({
    color: vars.text.success,
});
