import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const keypass = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
});

export const errorText = style({
    color: vars.text.error,
});
