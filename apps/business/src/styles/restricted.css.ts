import { vars } from "@frak-labs/design-system/theme";
import { globalStyle } from "@vanilla-extract/css";

globalStyle('html[data-page="restricted"]', {
    color: vars.text.primary,
    backgroundColor: vars.surface.background,
});
