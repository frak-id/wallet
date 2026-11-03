import { keyframes, style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";
import { vars } from "../../theme.css";
import { alias, easing, shadow, transition, zIndex } from "../../tokens.css";

const fadeScaleIn = keyframes({
    from: { opacity: 0, transform: "translate(-50%, -48%) scale(0.96)" },
    to: { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
});

/**
 * `top` stacks above every other modal surface (sheets, dialogs, alert
 * dialogs at up to `modal + 3`) yet under popovers, for prompts such as a
 * re-auth challenge that can open from inside any of them.
 */
export const dialogContent = recipe({
    base: {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: vars.surface.elevated,
        borderRadius: alias.cornerRadius.l,
        boxShadow: shadow.dialog,
        padding: alias.spacing.l,
        width: "90vw",
        maxWidth: "480px",
        maxHeight: "85vh",
        overflowY: "auto",
        animationName: fadeScaleIn,
        animationDuration: transition.base,
        animationTimingFunction: easing.smooth,
        selectors: {
            "&:focus": { outline: "none" },
        },
    },
    variants: {
        layer: {
            default: { zIndex: zIndex.modal + 1 },
            top: { zIndex: zIndex.modal + 5 },
        },
    },
    defaultVariants: { layer: "default" },
});

export const dialogOverlay = recipe({
    variants: {
        layer: {
            default: {},
            // Outranks the base Overlay class regardless of stylesheet order.
            top: { selectors: { "&&": { zIndex: zIndex.modal + 4 } } },
        },
    },
    defaultVariants: { layer: "default" },
});

export const dialogTitleStyle = style({
    margin: 0,
    fontWeight: 600,
    fontSize: "18px",
    color: vars.text.primary,
});

export const dialogDescriptionStyle = style({
    marginTop: alias.spacing.xs,
    fontSize: "14px",
    lineHeight: 1.5,
    color: vars.text.secondary,
});
