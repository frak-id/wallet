import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Lay the radio options out in a wrapping row (DS RadioGroup is column). */
export const group = style({
    flexDirection: "row",
    flexWrap: "wrap",
    gap: alias.spacing.m,
});

export const option = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.m,
    // Fixed ~205px slot keeps two-up rows (language) compact and
    // left-aligned instead of spreading across the full card width.
    flex: "0 1 205px",
    minWidth: 0,
    padding: alias.spacing.m,
    borderRadius: alias.cornerRadius.l,
    cursor: "pointer",
});

/** Stretch options to share the row equally (currency: 3 across). */
export const optionFill = style({
    flex: "1 0 0",
});

export const content = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    minWidth: 0,
});

export const icon = style({
    display: "inline-flex",
    flexShrink: 0,
});
