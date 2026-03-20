import { vars } from "@frak-labs/design-system/theme";
import { brand, easing, transition } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const pillRadius = "999px";

export const bottomTabBarStyles = {
    wrapper: style({
        position: "relative",
        width: "100%",
        maxWidth: "346px",
        aspectRatio: "346 / 114",
        margin: "0 auto",
        isolation: "isolate",
    }),

    backgroundImage: style({
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 0,
        userSelect: "none",
    }),

    pill: style({
        position: "absolute",
        // Inset 4px from PNG pill bounds (x=26 y=26 w=294 h=62) → x=30 y=30 w=286 h=54
        left: "8.671%",
        top: "26.316%",
        width: "82.659%",
        height: "47.368%",
        display: "flex",
        alignItems: "stretch",
        borderRadius: pillRadius,
        overflow: "hidden",
        zIndex: 1,
    }),

    tab: style({
        position: "relative",
        display: "flex",
        flex: "1 1 0",
        minWidth: 0,
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "2px",
        padding: "8px 12px",
        border: "none",
        borderRadius: pillRadius,
        background: "transparent",
        cursor: "pointer",
        zIndex: 1,
        color: vars.text.secondary,
        lineHeight: "12px",
        whiteSpace: "nowrap",
        transition: `color ${transition.base} ${easing.default}`,
        WebkitTapHighlightColor: "transparent",
    }),

    tabActive: style({
        color: vars.text.action,
    }),

    tabLabel: style({
        fontSize: "10px",
        fontWeight: brand.typography.fontWeight.semiBold,
        letterSpacing: "-0.01em",
    }),

    tabIconWrapper: style({
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: vars.icon.primary,
        transition: `color ${transition.base} ${easing.default}`,
    }),

    tabIconWrapperActive: style({
        color: vars.icon.action,
    }),

    glider: style({
        position: "absolute",
        inset: "0 auto 0 0",
        display: "block",
        width: "35.6643%",
        borderRadius: pillRadius,
        background: "rgba(118, 118, 128, 0.12)",
        mixBlendMode: "plus-darker",
        zIndex: 0,
        pointerEvents: "none",
        transition: `transform ${transition.slow} ${easing.decelerate}`,
    }),
};
