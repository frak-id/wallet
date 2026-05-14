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
    "@media": {
        "(hover: hover)": {
            color: vars.text.actionHover,
        },
    },
});

globalStyle("body", {
    position: "relative",
    overflow: "hidden",
    backgroundColor: vars.surface.background2,
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

/**
 * Native (Tauri) override: the desktop-only "phone frame" centering does not
 * apply when the app runs as a native shell (iPad must fill the device).
 * Keep the rule scoped to tablet+ widths to avoid touching mobile defaults.
 */
globalStyle(':root[data-platform="tauri"] body', {
    "@media": {
        [`(min-width: ${tablet}px)`]: {
            display: "block",
            minHeight: "unset",
        },
    },
});
