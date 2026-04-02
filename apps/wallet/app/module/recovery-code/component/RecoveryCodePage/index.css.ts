import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const wrapper = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
    padding: `${alias.spacing.l} ${alias.spacing.m}`,
});

export const description = style({
    fontSize: fontSize.m,
    color: vars.text.secondary,
    lineHeight: 1.5,
});
