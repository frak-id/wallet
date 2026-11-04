import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

export const screen = style({
    position: "absolute",
    inset: 0,
    overflow: "hidden",
});

// Own stacking context, so the wallet's tab bar stays under the flow.
export const layer = style({
    position: "absolute",
    inset: 0,
    isolation: "isolate",
});

export const featureCell = style({
    width: "100%",
    paddingInline: alias.spacing.m,
    paddingBlock: alias.spacing.s,
});

export const featureIconSlot = style({
    display: "flex",
    flexShrink: 0,
    paddingBlock: 2,
    color: vars.icon.primary,
});

export const partners = style({
    paddingBlock: alias.spacing.s,
});

export const frakBadge = style({
    display: "block",
    borderRadius: alias.cornerRadius.m,
});

const travel = keyframes({
    "0%, 100%": { opacity: 0.25 },
    "40%": { opacity: 1 },
});

export const dot = style({
    width: 6,
    height: 6,
    borderRadius: alias.cornerRadius.full,
    background: vars.icon.action,
    animation: `${travel} 1.1s ease-in-out infinite`,
    selectors: {
        "&:nth-child(2)": { animationDelay: "0.15s" },
        "&:nth-child(3)": { animationDelay: "0.3s" },
    },
});

export const handoffRow = style({
    width: "100%",
    minHeight: 56,
    paddingInline: alias.spacing.m,
    paddingBlock: alias.spacing.s,
});

export const handoffIcon = style({
    display: "flex",
    flexShrink: 0,
    color: vars.icon.secondary,
});

export const handoffState = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xxs,
    flexShrink: 0,
    color: vars.icon.success,
});
