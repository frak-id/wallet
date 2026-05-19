import { vars } from "@frak-labs/design-system/theme";
import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle } from "@vanilla-extract/css";
import { brandColors } from "./brand";

globalStyle("*, *::after, *::before", {
    margin: 0,
    boxSizing: "border-box",
});

globalStyle("html", {
    fontFamily: `"Inter", ${brand.typography.fontFamily.inter}`,
    fontStyle: "normal",
    fontWeight: brand.typography.fontWeight.medium,
    fontSize: "16px",
    scrollBehavior: "smooth",
    overflowX: "hidden",
});

globalStyle("body", {
    fontSize: "14px",
    lineHeight: 1.5,
    WebkitFontSmoothing: "antialiased",
    overflowX: "hidden",
    margin: 0,
    padding: 0,
});

globalStyle("ul", {
    margin: 0,
    padding: 0,
    listStyle: "none",
});

globalStyle("a", {
    color: vars.text.primary,
    textDecoration: "none",
});

globalStyle(".error", {
    color: brand.colors.error[600],
});

globalStyle(".success", {
    color: brandColors.neonGreen,
});

globalStyle(".link", {
    color: brand.colors.primary[500],
});
