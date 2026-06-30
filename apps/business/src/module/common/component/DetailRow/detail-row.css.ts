import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const rowBase = {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: alias.spacing.m,
    width: "100%",
} as const;

/** Single-line detail row: fixed 49px tall, content vertically centered. */
export const row = style({
    ...rowBase,
    minHeight: "49px",
});

/** Stacked-value row (multi-line address, budget, rewards): grows with 16px top/bottom. */
export const rowTall = style({
    ...rowBase,
    paddingBlock: alias.spacing.m,
});
