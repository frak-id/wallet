import { vars } from "@frak-labs/design-system/theme";
import { alias, easing, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const slides = style({
    flex: 1,
    display: "flex",
    overflowX: "auto",
    scrollSnapType: "x mandatory",
    overscrollBehaviorX: "contain",
    scrollbarWidth: "none",
    touchAction: "manipulation",
    WebkitOverflowScrolling: "touch",
    selectors: {
        "&::-webkit-scrollbar": {
            display: "none",
        },
    },
});

export const slide = style({
    flex: "0 0 100%",
    scrollSnapAlign: "start",
    scrollSnapStop: "always",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
});

export const dots = style({
    display: "flex",
    gap: alias.spacing.s,
    justifyContent: "center",
    alignItems: "center",
});

export const dot = style({
    border: "none",
    padding: 0,
    cursor: "pointer",
    width: "6px",
    height: "6px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.icon.disabled,
    transition: `background-color ${transition.slow} ${easing.default}, width ${transition.slow} ${easing.default}, height ${transition.slow} ${easing.default}`,
});

export const dotActive = style({
    width: "8px",
    height: "8px",
    backgroundColor: vars.icon.primary,
});
