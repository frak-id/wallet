import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const errorPanel = style({
    backgroundColor: vars.surface.error,
    borderRadius: alias.cornerRadius.m,
    paddingBlock: alias.spacing.s,
    paddingInline: alias.spacing.m,
    width: "100%",
    overflowWrap: "anywhere",
});
