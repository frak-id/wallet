import { vars } from "@frak-labs/design-system/theme";
import { alias, shadow, zIndex } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

/**
 * Wrapper positioning for the floating soft-update prompt. The Card itself
 * (background, padding, radius) comes from the design-system; only the
 * fixed positioning + safe-area handling + responsive max-width live here.
 */
export const banner = style({
    position: "fixed",
    left: alias.spacing.s,
    right: alias.spacing.s,
    bottom: `calc(env(safe-area-inset-bottom, 0px) + ${alias.spacing.s})`,
    zIndex: zIndex.toast,
    boxShadow: shadow.dialog,
    "@media": {
        "(min-width: 768px)": {
            left: "auto",
            maxWidth: "420px",
        },
    },
});

export const progressTrack = style({
    width: "100%",
    height: "4px",
    borderRadius: alias.cornerRadius.full,
    background: vars.surface.muted,
    overflow: "hidden",
});

export const progressBar = style({
    height: "100%",
    background: vars.surface.primary,
    transition: "width 200ms linear",
});
