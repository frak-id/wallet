import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const dots = style({
    display: "flex",
    height: "6px",
    gap: alias.spacing.xxs,
    justifyContent: "center",
    alignItems: "center",
});

export const dot = style({
    border: "none",
    padding: 0,
    cursor: "pointer",
    width: "4px",
    height: "4px",
    borderRadius: alias.cornerRadius.full,
    backgroundColor: vars.icon.disabled,
    opacity: 0.7,
    transition:
        "width 0.25s ease-out, height 0.25s ease-out, opacity 0.25s ease-out",
});

export const dotActive = style({
    width: "6px",
    height: "6px",
    opacity: 1,
});
