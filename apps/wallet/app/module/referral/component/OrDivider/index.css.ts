import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const line = style({
    flex: "1 0 0",
    height: "1px",
    backgroundColor: vars.border.default,
});
