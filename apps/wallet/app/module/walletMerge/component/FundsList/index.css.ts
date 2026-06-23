import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const balanceRow = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.s,
});
