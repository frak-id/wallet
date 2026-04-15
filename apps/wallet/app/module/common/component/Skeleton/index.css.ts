import { vars } from "@frak-labs/design-system/theme";
import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const skeletonContainer = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: brand.scale[600],
});

export const skeleton = style({
    border: `1px solid ${vars.border.subtle}`,
});
