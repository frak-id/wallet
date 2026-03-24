import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const slide = style({
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    gap: alias.spacing.m,
});

export const slideImageBase = style({
    height: "350px",
    overflow: "hidden",
});

export const slideImage = style([slideImageBase]);

export const slideImageCenter = style([
    slideImageBase,
    {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
]);

export const slideImg = style({
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
});

export const slideContent = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const slideTitle = style({
    textAlign: "center",
    margin: 0,
    padding: `0 ${alias.spacing.m}`,
});

export const slideDescription = style({
    fontSize: fontSize.m,
    color: vars.text.secondary,
    textAlign: "center",
    margin: 0,
    padding: `0 ${alias.spacing.m}`,
});
