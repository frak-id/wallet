import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const row = style({
    width: "100%",
    padding: 0,
    border: "none",
    background: "transparent",
    textAlign: "left",
    font: "inherit",
    color: "inherit",
    cursor: "pointer",
    selectors: {
        "&:active": { background: vars.surface.disabled },
    },
});

export const iconWrapper = style({
    marginTop: 2,
    marginRight: 5,
    flexShrink: 0,
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: alias.cornerRadius.full,
    background: vars.surface.tertiary,
});

export const info = style({
    minWidth: 0,
});

export const amount = style({
    flexShrink: 0,
});
