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
    // A native host presenting a wallet page inside its own sheet sets
    // `--frak-host-surface: transparent`, so the top corners its page rounds
    // cut through to the host's scrim. `html` carries no background of its
    // own, so making this transparent is enough: with no background here
    // there is nothing left to propagate to the document canvas, which is the
    // one surface `border-radius` can never clip.
    //
    // Written as a fallback rather than an override so the host never has to
    // win a specificity fight with this rule — the previous approach reached
    // in from a route hook and assigned `document.body.style.backgroundColor`
    // at runtime, purely to outrank it.
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
