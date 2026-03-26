import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

const heroImageBase = style({
    height: "350px",
    overflow: "hidden",
});

export const heroImage = style([heroImageBase]);

export const heroImageCenter = style([
    heroImageBase,
    {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        margin: `0 ${alias.spacing.m}`,
    },
]);

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
    color: vars.text.secondary,
    textAlign: "center",
    margin: 0,
    padding: `0 ${alias.spacing.m}`,
});
