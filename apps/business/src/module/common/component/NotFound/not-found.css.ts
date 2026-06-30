import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    justifyContent: "center",
    width: "100%",
    padding: "2rem",
});

export const card = style({
    maxWidth: "560px",
    padding: "2.5rem 2rem",
});

export const badgeIcon = style({
    color: vars.icon.action,
});
