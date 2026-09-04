import { globalStyle } from "@vanilla-extract/css";
import { tablet } from "./breakpoints";
import { hostSheet, hostSheetVar } from "./hostSheet";
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
    // A native host sets `--frak-host-surface: transparent` so the page's
    // rounded top corners cut through to its scrim. Written as a fallback, not
    // an override, so the host never has to win a specificity fight.
    backgroundColor: hostSheet(hostSheetVar.surface, vars.surface.background2),
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
 * A native shell owns the window, so drop the desktop centering: Tauri fills
 * the device, and a host's sheet is full-bleed at every width.
 */
globalStyle(
    ':root[data-platform="tauri"] body, :root[data-embed="native"] body',
    {
        "@media": {
            [`(min-width: ${tablet}px)`]: {
                display: "block",
                minHeight: "unset",
            },
        },
    }
);
