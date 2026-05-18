import { vars } from "@frak-labs/design-system/theme";
import { globalStyle, style } from "@vanilla-extract/css";
import { brandBackgrounds, brandColors } from "@/styles/brand";

globalStyle("html:has(main[data-embedded-layout])", {
    color: vars.text.primary,
    backgroundColor: brandColors.blueZodiacDarker,
    backgroundImage: brandBackgrounds.dark,
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
});

export const main = style({
    padding: "20px",
});
