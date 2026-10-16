import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const row = style({
    width: "100%",
    textAlign: "left",
    appearance: "none",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    font: "inherit",
    color: "inherit",
});

export const iconWrapper = style({
    position: "relative",
    marginTop: 2,
    marginRight: 5,
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: alias.cornerRadius.full,
    background: vars.surface.tertiary,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
});

export const info = style({
    minWidth: 0,
});

export const statusText = style({
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});
