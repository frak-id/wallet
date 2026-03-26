import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const sectionTitle = style({
    color: vars.text.secondary,
    margin: 0,
});

export const emptyLayout = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: alias.spacing.m,
});
