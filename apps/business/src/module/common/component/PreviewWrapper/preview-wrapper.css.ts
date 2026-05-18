import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const previewWrapper = style({
    margin: `${alias.spacing.m} 0`,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.xs,
    padding: alias.spacing.m,
    border: `1px dashed ${vars.border.default}`,
    borderRadius: "10px",
    background: `color-mix(in srgb, ${vars.surface.muted} 50%, transparent)`,
});
