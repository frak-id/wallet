import { vars } from "@frak-labs/design-system/theme";
import { alias, safeArea, zIndex } from "@frak-labs/design-system/tokens";
import { keyframes, style } from "@vanilla-extract/css";

const popIn = keyframes({
    from: { opacity: 0, transform: "scale(0.9)" },
    to: { opacity: 1, transform: "scale(1)" },
});

const fadeIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

export const screen = style({
    position: "fixed",
    inset: 0,
    zIndex: zIndex.modal,
    display: "flex",
    flexDirection: "column",
    backgroundColor: vars.surface.background2,
    paddingLeft: alias.spacing.l,
    paddingRight: alias.spacing.l,
    paddingTop: `calc(${safeArea.top} + ${alias.spacing.l})`,
    paddingBottom: `calc(${safeArea.bottom} + ${alias.spacing.l})`,
    animation: `${fadeIn} 0.2s ease both`,
});

export const body = style({
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: alias.spacing.m,
    textAlign: "center",
});

export const amount = style({
    animation: `${popIn} 0.3s cubic-bezier(0.23, 1, 0.32, 1) both`,
    "@media": {
        "(prefers-reduced-motion: reduce)": {
            animation: `${fadeIn} 0.2s ease both`,
        },
    },
});

export const actions = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.s,
    width: "100%",
});
