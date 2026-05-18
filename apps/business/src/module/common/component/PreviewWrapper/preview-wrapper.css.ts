import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const previewWrapper = style({
    margin: "16px 0",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "16px",
    border: `1px dashed ${vars.border.default}`,
    borderRadius: "10px",
    background: `color-mix(in srgb, ${vars.surface.muted} 50%, transparent)`,
});

export const previewWrapperLabel = style({
    margin: 0,
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: vars.text.tertiary,
});
