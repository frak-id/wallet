import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, fontSize, shadow, zIndex } from "../../tokens.css";

const fadeSlideIn = keyframes({
    from: { opacity: 0, transform: "translateY(-4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
});

export const tooltipContent = style({
    backgroundColor: vars.text.primary,
    color: vars.text.onAction,
    borderRadius: alias.cornerRadius.s,
    paddingTop: alias.spacing.xxs,
    paddingBottom: alias.spacing.xxs,
    paddingLeft: alias.spacing.xs,
    paddingRight: alias.spacing.xs,
    fontSize: fontSize.xs,
    lineHeight: 1.4,
    maxWidth: "200px",
    boxShadow: shadow.elevated,
    zIndex: zIndex.popover,
    userSelect: "none",
    animationName: fadeSlideIn,
    animationDuration: "0.2s",
    animationTimingFunction: "cubic-bezier(0.25, 0.1, 0.25, 1)",
});

export const tooltipArrow = style({
    fill: vars.text.primary,
});
