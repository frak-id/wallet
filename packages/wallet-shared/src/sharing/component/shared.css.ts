import { tablet } from "@frak-labs/design-system/breakpoints";
import { alias } from "@frak-labs/design-system/tokens";
import { keyframes, type StyleRule, style } from "@vanilla-extract/css";

/**
 * Shared responsive container styles for tablet+.
 * Turns the full-viewport layout into a centered card.
 */
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
 * Footer bottom border-radius for tablet+ to match the container corners.
 */
export const tabletFooterMedia: StyleRule["@media"] = {
    [`screen and (min-width: ${tablet}px)`]: {
        borderRadius: `0 0 ${alias.cornerRadius.xl} ${alias.cornerRadius.xl}`,
    },
};

const overlayShow = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

/**
 * Full-viewport overlay backdrop for tablet+.
 * On mobile, this is invisible (no styles applied).
 */
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
