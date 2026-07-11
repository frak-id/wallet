import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const toggle = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    background: "none",
    padding: 0,
    cursor: "pointer",
    color: vars.icon.secondary,
    ":hover": {
        color: vars.icon.primary,
    },
});
