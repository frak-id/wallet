import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const chip = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xs,
    height: "36px",
    padding: `0 ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.surface.muted,
    color: vars.text.primary,
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 500,
});
