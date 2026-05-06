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

/**
 * Modal-style internal layout — copied from the wallet's confirmation
 * modals (see `DeleteRedemptionConfirmModal`) so the soft-update prompt
 * doesn't feel like a different surface.
 */
export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
    width: "100%",
});

export const text = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
    width: "100%",
});

/**
 * Centered icon-led layout for success states (e.g. update downloaded).
 * Mirrors the wallet's success modals (`RecoveryCodeSuccessModal`,
 * `MoneriumTransferSuccessModal`) so the icon reads as a status badge
 * rather than a row decoration.
 */
export const successContent = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.s,
    width: "100%",
    textAlign: "center",
});

export const actions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    width: "100%",
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

export const downloadedIcon = style({
    color: vars.icon.action,
    flexShrink: 0,
});
