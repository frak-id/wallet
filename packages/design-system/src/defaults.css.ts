import { globalStyle } from "@vanilla-extract/css";
import { tablet } from "./breakpoints";
import { vars } from "./theme.css";
import { brand } from "./tokens.css";

globalStyle("html", {
    fontFamily: brand.typography.fontFamily.inter,
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
});

globalStyle("a", {
    color: vars.text.action,
    textDecoration: "none",
});

globalStyle("a:hover", {
    color: vars.text.actionHover,
});

globalStyle("body", {
    position: "relative",
    overflow: "hidden",
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            display: "flex",
            flexDirection: "row",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100dvh",
        },
    },
});
