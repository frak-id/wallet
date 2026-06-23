import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const pagination = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 24px",
    borderTop: `1px solid ${vars.border.subtle}`,
});
