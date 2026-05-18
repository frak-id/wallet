import { vars } from "@frak-labs/design-system/theme";
import { globalStyle } from "@vanilla-extract/css";
import { brandBackgrounds, brandColors } from "./brand";

globalStyle('html[data-page="restricted"]', {
    color: vars.text.primary,
    backgroundColor: brandColors.blueZodiacDarker,
    backgroundImage: brandBackgrounds.dark,
    backgroundSize: "cover",
    backgroundAttachment: "fixed",
});
