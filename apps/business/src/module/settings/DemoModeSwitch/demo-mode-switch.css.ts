import { vars } from "@frak-labs/design-system/theme";
import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const demoModeSwitchLabel = style({
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.primary,
    cursor: "pointer",
});

export const demoModeSwitchWarning = style({
    fontSize: "13px",
    color: vars.text.warning,
    backgroundColor: "rgba(255, 165, 0, 0.1)",
    padding: "8px 12px",
    borderRadius: "6px",
    margin: 0,
    fontWeight: brand.typography.fontWeight.medium,
});
