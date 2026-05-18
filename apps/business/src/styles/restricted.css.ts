import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle } from "@vanilla-extract/css";
import { brandBackgrounds, brandColors } from "./brand";

globalStyle('html[data-page="restricted"]', {
    // White text for bare content on the dark navy backdrop. Component
    // surfaces (Panel/Card) still resolve to DS light-theme tokens so they
    // render as light cards over the dark background.
    color: brand.colors.neutral.white,
    backgroundColor: brandColors.blueZodiacDarker,
    backgroundImage: brandBackgrounds.dark,
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
});
