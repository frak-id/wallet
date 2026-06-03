import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const heroImageBase = style({
    // ~220px on iPhone SE (667px) → 350px on iPhone 12+ (844px), via
    // height = 73.5dvh - 270px clamped. Keeps the CTAs on screen on short devices.
    height: "clamp(220px, calc(73.5dvh - 270px), 350px)",
    flex: "0 0 auto",
    overflow: "hidden",
});

export const heroImage = style([heroImageBase]);

const heroImageCenterBase = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
} as const;

export const heroImageCenter = style([
    heroImageBase,
    {
        ...heroImageCenterBase,
        margin: `0 ${alias.spacing.m}`,
    },
]);

// Centered image at its natural size (steps 2 & 3 via imageMaxWidth, Welcome
// full-bleed) — not the step-1 band clamp, whose 220px floor shrank these on
// small screens. Too-tall pages scroll (PageLayout) rather than shrink it.
export const heroImageTall = style({
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    flex: "0 0 auto",
    overflow: "hidden",
});

export const heroContent = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const heroTitle = style({
    textAlign: "center",
    margin: 0,
    padding: `0 ${alias.spacing.m}`,
});

export const heroDescription = style({
    fontSize: fontSize.m,
    lineHeight: "26px",
    color: vars.text.secondary,
    textAlign: "center",
    margin: 0,
    padding: `0 ${alias.spacing.m}`,
});
