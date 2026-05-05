import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const modifyAction = style({
    display: "inline-flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    color: vars.text.action,
});
