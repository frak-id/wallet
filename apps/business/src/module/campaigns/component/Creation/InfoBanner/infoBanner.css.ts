import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Light-blue bar with a blue info icon + black text. */
export const banner = style({
    display: "flex",
    gap: alias.spacing.m,
    alignItems: "center",
    paddingLeft: alias.spacing.m,
    paddingRight: alias.spacing.l,
    paddingTop: alias.spacing.s,
    paddingBottom: alias.spacing.s,
    backgroundColor: vars.surface.secondary,
    borderRadius: alias.cornerRadius.m,
});

export const icon = style({
    color: vars.text.action,
    flexShrink: 0,
});
