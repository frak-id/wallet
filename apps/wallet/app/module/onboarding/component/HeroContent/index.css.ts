import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const heroImageBase = style({
    // Linear viewport-height interpolation between two device targets:
    //   iPhone SE  (667px tall) → 220px  (keeps the 3 CTAs on screen, design spec)
    //   iPhone 12+ (844px tall) → 350px  (restores the prior/"today" framing)
    // Solved from those endpoints: height = 73.5dvh - 270px, then clamped so it
    // never drops below 220px or exceeds the legacy 350px. `dvh` is already the
    // app's viewport-height unit (see AppShell).
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

export const heroImageCenterBleed = style([heroImageBase, heroImageCenterBase]);

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
