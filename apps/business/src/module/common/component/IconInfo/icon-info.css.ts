import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const iconInfo = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "12px",
    height: "12px",
    border: `1px solid ${vars.text.tertiary}`,
    borderRadius: "50%",
    color: vars.text.tertiary,
    fontSize: "10px",
    cursor: "default",
});
