import { vars } from "@frak-labs/design-system/theme";
import {
    alias,
    brand,
    easing,
    transition,
} from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const pillRadius = "999px";

export const bottomTabBarStyles = {
    /**
     * Outer wrapper — fills the entire bottom bar area.
     * Hosts the progressive blur background and the glass pill.
     * Padding moved here from AppShell's bottomBar so the blur
     * covers the full fixed area (including padding zones).
     *
     * No isolation: isolate — that would create a compositing
     * boundary that prevents backdrop-filter from seeing through
     * to the actual page content.
     */
    wrapper: style({
        position: "relative",
        width: "100%",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-end",
        padding: `${alias.spacing.s} ${alias.spacing.m}`,
        paddingBottom: `calc(${alias.spacing.s} + env(safe-area-inset-bottom, 0px))`,
    }),

    /**
     * Progressive blur — fades from strong blur at the bottom to
     * transparent at the top, so scrolled content smoothly dissolves
     * behind the tab bar.
     *
     * The near-transparent background (0.01 alpha) gives the
     * compositor a painted surface to apply the filter on.
     * Mask is oriented to-top: full opacity at bottom, transparent at top.
     */
    progressiveBlur: style({
        position: "absolute",
        inset: 0,
        background: "rgba(255, 255, 255, 0.01)",
        backdropFilter: "blur(14px) saturate(130%)",
        maskImage:
            "linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.45) 55%, transparent 100%)",
        zIndex: 0,
        pointerEvents: "none",
    }),

    /**
     * Glass pill — the frosted-glass tab container.
     * backdrop-filter for the blur, whitish fill, subtle gray
     * border + inner shadow for glass edge definition.
     */
    pill: style({
        position: "relative",
        display: "flex",
        alignItems: "stretch",
        width: "100%",
        maxWidth: "286px",
        borderRadius: pillRadius,
        overflow: "hidden",
        zIndex: 1,
        backdropFilter: "blur(5px) saturate(180%)",
        background: "rgba(255, 255, 255, 0.55)",
        border: "1px solid rgba(0, 0, 0, 0.06)",
        boxShadow: "inset 0 0 8px rgba(0, 0, 0, 0.06)",
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
        padding: "8px 22px",
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

    /**
     * Active tab indicator — slides behind the active tab.
     * Width is set inline as `(1 / tabs.length) * 100%` so it
     * adapts to any number of tabs.
     */
    glider: style({
        position: "absolute",
        top: "2px",
        bottom: "2px",
        left: "2px",
        display: "block",
        borderRadius: pillRadius,
        background: "rgba(118, 118, 128, 0.12)",
        mixBlendMode: "plus-darker",
        zIndex: 0,
        pointerEvents: "none",
        transition: `transform ${transition.slow} ${easing.decelerate}`,
    }),
};
