import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const buttonAction = style({
    width: "75px",
    height: "75px",
    border: "none",
    borderRadius: alias.cornerRadius.m,
    backgroundColor: vars.surface.elevated,
    boxShadow: "-4px -4px 7px 0 #00000014 inset",
    color: vars.text.primary,
    fontSize: "10px",
    cursor: "pointer",
    fontWeight: 700,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "3px",
    whiteSpace: "nowrap",
});
