import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle } from "@vanilla-extract/css";

globalStyle('html[data-page="authentication"]', {
    position: "relative",
    overflow: "hidden",
    height: "100%",
    background: brand.colors.neutral.white,
    color: brand.colors.neutral.grey800,
});

globalStyle('html[data-page="authentication"] body', {
    position: "relative",
    overflow: "hidden",
    height: "100%",
});

globalStyle('html[data-page="authentication"] a', {
    color: brand.colors.neutral.grey800,
});
