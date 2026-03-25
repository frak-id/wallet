import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, zIndex } from "../../tokens.css";

const fadeIn = keyframes({
    from: { opacity: 0 },
    to: { opacity: 1 },
});

export const drawerOverlayStyle = style({
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    position: "fixed",
    zIndex: zIndex.modal,
    inset: 0,
    animationName: fadeIn,
    animationDuration: "250ms",
    animationTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)",
});

export const drawerContentWrapperStyle = style({
    /**
     * Creates a new stacking context so toaster stays inside the drawer.
     */
    transform: "translateZ(0)",
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: zIndex.modal,
    maxHeight: "100dvh",
    marginTop: alias.spacing.l,
    display: "flex",
    flexDirection: "column",
    margin: `0 ${alias.spacing.m}`,
    marginBottom: `max(${alias.spacing.m}, env(safe-area-inset-bottom))`,
});

export const drawerContentStyle = style({
    padding: `${alias.spacing.l} ${alias.spacing.m}`,
    overflow: "auto",
    maxHeight: "91dvh",
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.xl,
});

export const drawerHandleStyle = style({
    margin: `${alias.spacing.m} auto 0 auto`,
    height: "8px",
    width: "100px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.border.default,
});

export const drawerHeaderStyle = style({
    display: "grid",
    gap: "6px",
});

export const drawerFooterStyle = style({
    marginTop: "auto",
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.xs,
});
