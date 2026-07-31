import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/** Android/iOS tag in front of each entry. The rest is `allowed-list-sheet`. */
export const platformBadge = style({
    flexShrink: 0,
    padding: `2px ${alias.spacing.s}`,
    borderRadius: alias.cornerRadius.s,
    backgroundColor: vars.surface.muted,
    fontSize: fontSize.xs,
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
    textTransform: "uppercase",
});
