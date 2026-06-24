import { vars } from "@frak-labs/design-system/theme";
import { alias, brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Notification title cell: single line, truncated with an ellipsis when it
 * overflows (the design clips the long title, never wraps).
 */
export const notificationCell = style({
    // The table uses `table-layout: fixed`, so the Notification column flexes
    // to fill the width left by the other (sized) columns. This wrapper just
    // clips to that computed width: the full title shows when the column is
    // wide, and the ellipsis appears only on a genuine overflow.
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});

/* ---- Filters --------------------------------------------------------- */

export const filtersPopoverContent = style({
    padding: alias.spacing.m,
    width: 220,
});

export const filtersCount = style({
    display: "block",
    minWidth: "18px",
    height: "18px",
    padding: "2px 6px",
    borderRadius: "100px",
    background: brand.colors.primary[500],
    color: brand.colors.neutral.white,
    fontSize: "10px",
    fontWeight: brand.typography.fontWeight.semiBold,
    lineHeight: "14px",
    textAlign: "center",
});

export const statusOption = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.primary,
});

/**
 * "Sent / Opened" cell: an `opened` / `sent` counter row above a thin
 * progress bar of the open rate.
 */
export const sentOpened = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    width: "100%",
});

export const sentOpenedRow = style({
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "12px",
    lineHeight: "20px",
    fontWeight: brand.typography.fontWeight.medium,
});

export const sentOpenedValue = style({
    color: vars.text.action,
});

export const sentOpenedTotal = style({
    color: vars.text.secondary,
});
