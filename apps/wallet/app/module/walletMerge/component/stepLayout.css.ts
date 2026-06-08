import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const footer = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    width: "100%",
});
