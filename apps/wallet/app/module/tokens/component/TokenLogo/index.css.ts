import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const tokenLogo = style({
    display: "flex",
    borderRadius: alias.cornerRadius.full,
    overflow: "hidden",
});
