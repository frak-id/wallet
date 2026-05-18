import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const iconInfo = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "12px",
    height: "12px",
    border: `1px solid ${vars.text.tertiary}`,
    borderRadius: alias.cornerRadius.full,
    color: vars.text.tertiary,
    fontSize: "10px",
    cursor: "default",
});
