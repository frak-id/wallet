import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style, styleVariants } from "@vanilla-extract/css";

const merchantLogoBase = style({
    borderRadius: alias.cornerRadius.full,
    border: `1px solid ${vars.border.default}`,
    flexShrink: 0,
});

export const merchantLogo = styleVariants({
    small: [merchantLogoBase, { width: 40, height: 40 }],
    large: [merchantLogoBase, { width: 64, height: 64 }],
});

export const merchantLogoImg = style({
    width: "100%",
    height: "100%",
    borderRadius: "inherit",
    objectFit: "cover",
});

const merchantLogoFallbackBase = style({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: "100%",
    borderRadius: "inherit",
    letterSpacing: "-0.03em",
    fontWeight: 600,
    color: vars.text.primary,
    background: vars.surface.background,
});

export const merchantLogoFallback = styleVariants({
    small: [merchantLogoFallbackBase, { fontSize: 23 }],
    large: [
        merchantLogoFallbackBase,
        { fontSize: 37, letterSpacing: "-0.15em" },
    ],
});
