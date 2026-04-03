import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const codeChar = style({
    width: 44,
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: alias.cornerRadius.m,
    background: vars.surface.muted,
    fontSize: fontSize.xl,
    fontWeight: 700,
    color: vars.text.primary,
    userSelect: "all",
});
