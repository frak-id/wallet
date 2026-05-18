import { brand } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const buttonCalendarTrigger = style({
    gap: "8px",
    border: `1px solid ${brand.colors.neutral.grey250} !important`,
    color: `${brand.colors.neutral.grey700} !important`,
});
