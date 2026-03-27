import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const emptyTransferredGains = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
});

export const header = style({
    display: "flex",
    justifyContent: "flex-end",
});
