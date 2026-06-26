import { vars } from "@frak-labs/design-system/theme";
import { globalStyle, style } from "@vanilla-extract/css";

globalStyle("html:has(main[data-embedded-layout])", {
    color: vars.text.primary,
    backgroundColor: vars.surface.background2,
});

export const main = style({
    padding: "20px",
});
