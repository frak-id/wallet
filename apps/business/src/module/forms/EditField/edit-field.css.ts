import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const item = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});

/** Label/hint inset aligns with the input text (16px padding). */
export const label = style({
    paddingInline: alias.spacing.m,
});

export const hint = style({
    paddingInline: alias.spacing.m,
    margin: 0,
    fontSize: fontSize.xs,
    lineHeight: "20px",
    color: vars.text.tertiary,
});

export const card = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    backgroundColor: vars.surface.background,
    borderRadius: alias.cornerRadius.m,
    padding: alias.spacing.m,
});
