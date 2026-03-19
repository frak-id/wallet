import { style } from "@vanilla-extract/css";
import { vars } from "@/theme.css";
import { brand, fontSize } from "@/tokens.css";

export const warning = style({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: brand.scale[200],
    padding: `${brand.scale[200]} ${brand.scale[300]}`,
    borderRadius: brand.scale[200],
    background: vars.surface.warning,
    color: vars.text.primary,
    fontSize: fontSize.xs,
});

export const warningText = style({
    fontFamily:
        '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Android Emoji", "EmojiOne Mozilla", "Twemoji Mozilla", "Noto Emoji", "Segoe UI Symbol", EmojiSymbols, emoji, sans-serif',
    fontSize: fontSize.xs,
});
