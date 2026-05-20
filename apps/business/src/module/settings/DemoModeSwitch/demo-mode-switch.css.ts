import { vars } from "@frak-labs/design-system/theme";
import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const demoModeSwitchLabel = style({
    fontSize: "14px",
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.primary,
    cursor: "pointer",
});
