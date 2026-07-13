import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.s,
});

export const line = style({
    flex: 1,
    height: "1px",
    background: vars.border.subtle,
});
