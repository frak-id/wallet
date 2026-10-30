import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Sized to content so a tall list scrolls under the pinned footer. */
export const body = style({
    flexShrink: 0,
    padding: `0 ${alias.spacing.m}`,
});

export const link = style({
    color: vars.text.action,
    textDecoration: "none",
});
