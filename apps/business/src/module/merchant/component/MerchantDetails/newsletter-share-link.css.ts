import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const shareUrl = style({
    margin: 0,
    padding: alias.spacing.s,
    backgroundColor: vars.surface.muted,
    color: vars.text.primary,
    borderRadius: alias.cornerRadius.s,
    fontSize: "13px",
    overflowX: "auto",
});
