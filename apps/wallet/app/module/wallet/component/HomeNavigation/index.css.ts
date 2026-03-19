import { alias } from "@frak-labs/design-system/tokens";
import { globalStyle, keyframes, style } from "@vanilla-extract/css";

export const homeNavigation = style({
    display: "flex",
    justifyContent: "space-between",
    margin: `0 var(--frak-spacing-s) ${alias.spacing.s} var(--frak-spacing-s)`,
});

export const button = style({
    display: "flex",
    flexDirection: "column",
    textDecoration: "none",
    gap: "var(--frak-spacing-xs)",
    textAlign: "center",
    width: "55px",
});

export const buttonIcon = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "55px",
    height: "55px",
    borderRadius: alias.cornerRadius.full,
    background: "var(--color-wallet-overlay-light)",
    backdropFilter: "blur(14px)",
});

const spin = keyframes({
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
});

export const buttonRefresh = style({
    display: "flex",
});

export const buttonRefreshing = style({});

globalStyle(`${buttonRefreshing} svg`, {
    animation: `${spin} 1s linear infinite`,
});
