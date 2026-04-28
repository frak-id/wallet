import { vars } from "@frak-labs/design-system/theme";
import { alias, brand, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const demoAccount = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: alias.spacing.s,
    padding: `${alias.spacing.s} ${alias.spacing.m}`,
    borderRadius: alias.cornerRadius.s,
    backgroundColor: vars.surface.secondary,
    color: vars.text.primary,
    fontSize: fontSize.s,
    fontWeight: brand.typography.fontWeight.bold,
});

export const demoAccountParagraph = style({
    display: "flex",
    alignItems: "center",
    gap: alias.spacing.xs,
});

export const demoAccountWarning = style({
    fontFamily:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiOne Mozilla", "Twemoji Mozilla", "Noto Emoji", "Segoe UI Symbol", EmojiSymbols, emoji, sans-serif',
    fontSize: fontSize.s,
});
