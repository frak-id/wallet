import { tablet } from "@frak-labs/design-system/breakpoints";
import { hostSheetTopRadius } from "@frak-labs/design-system/hostSheet";
import { alias } from "@frak-labs/design-system/tokens";
import { keyframes, type StyleRule, style } from "@vanilla-extract/css";

/** Turns the full-viewport layout into a centered card on tablet+. */
export const tabletContainerMedia: StyleRule["@media"] = {
    [`screen and (min-width: ${tablet}px)`]: {
        height: "auto",
        maxWidth: "560px",
        maxHeight: "90dvh",
        margin: "auto",
        borderRadius: alias.cornerRadius.xl,
        boxShadow: "0 20px 50px rgba(0, 0, 0, 0.35)",
    },
};

/**
 * Container variant for a host presenting this page in its own sheet: cancels the
 * tablet card treatment, rounds the top corners to the host-injected radius. `&&`
 * doubles the class so it beats `container`'s equal-specificity tablet rule.
 */
export const containerChromeless = style({
    selectors: {
        "&&": {
            borderRadius: hostSheetTopRadius,
            "@media": {
                [`screen and (min-width: ${tablet}px)`]: {
                    // Cancel the whole card treatment, including the properties
                    // that detach the container from the viewport.
                    maxWidth: "none",
                    maxHeight: "none",
                    height: "100dvh",
                    margin: 0,
                    boxShadow: "none",
                },
            },
        },
    },
});

/** Footer bottom border-radius for tablet+ to match the container corners. */
export const tabletFooterMedia: StyleRule["@media"] = {
    [`screen and (min-width: ${tablet}px)`]: {
        borderRadius: `0 0 ${alias.cornerRadius.xl} ${alias.cornerRadius.xl}`,
    },
};

const overlayShow = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

/** Full-viewport overlay backdrop for tablet+; invisible on mobile. */
export const overlay = style({
    "@media": {
        [`screen and (min-width: ${tablet}px)`]: {
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(0, 0, 0, 0.4)",
            animation: `${overlayShow} 250ms cubic-bezier(0.16, 1, 0.3, 1)`,
        },
    },
});

/**
 * Overlay variant for a host that presents this page inside its own sheet: the
 * host draws its own scrim, and this one would tint the sheet's rounded corners.
 * `&&` for the same reason as [containerChromeless].
 */
export const overlayChromeless = style({
    selectors: {
        "&&": {
            "@media": {
                [`screen and (min-width: ${tablet}px)`]: {
                    position: "static",
                    backgroundColor: "transparent",
                    display: "block",
                    // The host cross-fades its own skeleton into this page; a
                    // second opacity ramp here fights it.
                    animation: "none",
                },
            },
        },
    },
});
