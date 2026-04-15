import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const container = style({
    display: "flex",
    justifyContent: "center",
    gap: alias.spacing.m,
});

export const pasteButton = style({
    alignSelf: "center",
});

export const digitInput = style({
    width: 41,
    height: 56,
    borderRadius: alias.cornerRadius.m,
    border: `1px solid ${vars.surface.muted}`,
    background: vars.surface.muted,
    fontFamily: "inherit",
    fontSize: fontSize.xl,
    fontWeight: 600,
    textAlign: "center",
    color: vars.text.primary,
    outline: "none",
    caretColor: "transparent",
    selectors: {
        "&::placeholder": {
            color: vars.text.disabled,
        },
        "&:focus": {
            borderColor: vars.border.focus,
        },
    },
});

export const digitInputError = style({
    background: vars.surface.error,
});

export const digitInputReadOnly = style({
    cursor: "default",
    pointerEvents: "none",
});

export const errorMessage = style({
    color: vars.text.error,
    fontSize: fontSize.s,
    textAlign: "center",
});
