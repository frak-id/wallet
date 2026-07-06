import { keyframes, style } from "@vanilla-extract/css";
import { vars } from "../../theme.css";
import { alias, safeArea, zIndex } from "../../tokens.css";

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
    padding: `${alias.spacing.m} ${alias.spacing.m} ${alias.spacing.l} ${alias.spacing.m}`,
    overflow: "auto",
    maxHeight: "91dvh",
    backgroundColor: vars.surface.elevated,
    borderRadius: alias.cornerRadius.xl,
});

/**
 * `edgeToEdge` overrides: zero the wrapper's side + bottom margins so the sheet
 * spans the full width and sits flush against the bottom edge. Declared after
 * the base styles so they win by source order (no `!important` needed).
 */
export const drawerContentWrapperEdgeStyle = style({
    marginLeft: 0,
    marginRight: 0,
    marginBottom: 0,
});

export const drawerContentEdgeStyle = style({
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingBottom: `max(${alias.spacing.l}, ${safeArea.bottom})`,
});

/**
 * `surface="muted"` override: a grey sheet surface (instead of the default
 * elevated white) so nested white cards read with contrast. Declared after the
 * base style so it wins by source order.
 */
export const drawerContentMutedStyle = style({
    backgroundColor: vars.surface.background2,
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
