import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const merchantTag = style({
    display: "inline-flex",
    alignItems: "center",
    padding: `${alias.spacing.xxs} ${alias.spacing.xs}`,
    backgroundColor: vars.surface.muted,
    borderRadius: alias.cornerRadius.s,
});
