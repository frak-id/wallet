import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const row = style({
    appearance: "none",
    border: "none",
    background: "transparent",
    width: "100%",
    cursor: "pointer",
    textAlign: "left",
    padding: 0,
    color: "inherit",
    font: "inherit",
    selectors: {
        "&:active": {
            background: vars.surface.disabled,
        },
    },
});

export const iconBubble = style({
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: alias.cornerRadius.full,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: vars.surface.secondary,
    color: vars.icon.action,
});

export const rowInfo = style({
    flex: 1,
    minWidth: 0,
});

export const rowBadge = style({
    flexShrink: 0,
});
