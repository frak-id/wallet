import { alias } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

export const cardContainer = style({
    overflow: "hidden",
    borderRadius: alias.cornerRadius.xl,
    position: "relative",
});

export const dismissButton = style({
    position: "absolute",
    top: alias.spacing.xs,
    right: alias.spacing.xs,
    zIndex: 1,
});

export const slider = styleVariants({
    multiple: {
        display: "flex",
        gap: alias.spacing.xs,
        overflowX: "auto",
        scrollSnapType: "x mandatory",
        overscrollBehaviorX: "contain",
        scrollbarWidth: "none",
        touchAction: "pan-x",
        WebkitOverflowScrolling: "touch",
        selectors: {
            "&::-webkit-scrollbar": {
                display: "none",
            },
        },
    },
    single: {
        display: "flex",
        overflow: "hidden",
        touchAction: "auto",
    },
});

export const slide = styleVariants({
    multiple: {
        flex: `0 0 calc(100% - ${alias.spacing.xs})`,
        overflow: "hidden",
        borderRadius: alias.cornerRadius.xl,
        scrollSnapAlign: "start",
        scrollSnapStop: "always",
    },
    single: {
        flex: "1 1 100%",
        overflow: "hidden",
        borderRadius: alias.cornerRadius.xl,
    },
});

export const layoutRow = style({
    display: "flex",
    flexDirection: "row",
    width: "100%",
    height: "150px",
});

export const contentArea = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
    padding: alias.spacing.m,
    flex: "1 1 70%",
});

export const checkItem = style({
    display: "flex",
    flexDirection: "row",
    alignItems: "flex-start",
    gap: alias.spacing.xxs,
});

export const checkItemIcon = style({
    display: "flex",
    width: "12px",
    height: "12px",
    flexShrink: 0,
    marginTop: "3px",
});

export const logosSection = style({
    flex: "0 0 30%",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const logosImage = style({
    width: "100%",
    height: "auto",
    objectFit: "contain",
});

export const slideText = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xxs,
});

export const slideDescription = style({
    margin: 0,
});

export const featureItem = style({
    display: "flex",
    alignItems: "flex-start",
    gap: alias.spacing.xxs,
});

export const featureIcon = style({
    width: "12px",
    height: "20px",
    flexShrink: 0,
});
