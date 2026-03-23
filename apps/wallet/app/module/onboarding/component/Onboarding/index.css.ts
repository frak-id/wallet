import { alias, easing, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const onboarding = style({
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    margin: `0 calc(-1 * ${alias.spacing.m})`,
    paddingTop: "var(--safe-area-inset-top, env(safe-area-inset-top, 0px))",
    paddingBottom:
        "var(--safe-area-inset-bottom, env(safe-area-inset-bottom, 0px))",
});

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
});

export const footer = style({
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: alias.spacing.m,
    padding: `${alias.spacing.m}`,
});

export const dots = style({
    display: "flex",
    marginTop: alias.spacing.l,
    gap: alias.spacing.s,
    justifyContent: "center",
    alignItems: "center",
});

export const dot = style({
    width: "8px",
    height: "8px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: alias.neutral[300],
    transition: `background-color ${transition.slow} ${easing.default}`,
});

export const dotActive = style({
    backgroundColor: alias.neutral.default,
});
