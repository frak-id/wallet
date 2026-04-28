import { vars } from "@frak-labs/design-system/theme";
import { style } from "@vanilla-extract/css";

export const spinnerWrap = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100dvh",
    width: "100%",
    backgroundColor: vars.surface.background2,
});
