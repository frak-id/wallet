import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { alias, easing, shadow, transition, zIndex } from "@/tokens.css";

const fadeScaleIn = keyframes({
    from: { opacity: 0, transform: "translate(-50%, -48%) scale(0.96)" },
    to: { opacity: 1, transform: "translate(-50%, -50%) scale(1)" },
});

export const alertDialogContentStyle = style({
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
    zIndex: zIndex.modal + 1,
    animationName: fadeScaleIn,
    animationDuration: transition.base,
    animationTimingFunction: easing.smooth,
    selectors: {
        "&:focus": { outline: "none" },
    },
});

export const alertDialogTitleStyle = style({
    margin: 0,
    fontWeight: 600,
    fontSize: "18px",
    color: vars.text.primary,
});

export const alertDialogDescriptionStyle = style({
    marginTop: alias.spacing.s,
    fontSize: "14px",
    lineHeight: 1.5,
    color: vars.text.secondary,
});
