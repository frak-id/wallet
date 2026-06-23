import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const previewWrapper = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.m,
    paddingTop: alias.spacing.m,
    paddingInline: alias.spacing.m,
    paddingBottom: alias.spacing.l,
    border: `1px dashed ${vars.border.default}`,
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.muted,
});
