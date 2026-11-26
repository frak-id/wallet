import { vars } from "@frak-labs/design-system/theme";
import { alias, zIndex } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const card = style({
    width: "min(360px, calc(100vw - 32px))",
    padding: alias.spacing.m,
    outline: "none",
    selectors: {
        "&:focus-visible": {
            outline: `2px solid ${vars.text.action}`,
            outlineOffset: "2px",
        },
    },
});

export const highlight = style({
    position: "fixed",
    zIndex: zIndex.popover - 1,
    pointerEvents: "none",
    borderRadius: alias.cornerRadius.m,
    outline: `2px solid ${vars.text.action}`,
    outlineOffset: "3px",
});

export const centerAnchor = style({
    position: "fixed",
    top: "40%",
    left: "50%",
    width: 0,
    height: 0,
    pointerEvents: "none",
});

export const footer = style({
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: alias.spacing.xs,
});
