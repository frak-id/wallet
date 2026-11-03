import { vars } from "@frak-labs/design-system/theme";
import { alias, fontSize } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";
import { recipe } from "@vanilla-extract/recipes";

export const hero = style({
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
});

export const imageArea = recipe({
    base: {
        minHeight: 0,
        overflow: "hidden",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    },
    variants: {
        layout: {
            cover: { flex: "0 1 350px" },
            tall: { flex: "0 1 auto" },
        },
    },
});

export const image = recipe({
    base: { display: "block" },
    variants: {
        layout: {
            cover: {
                width: "100%",
                height: "100%",
                objectFit: "cover",
                objectPosition: "center",
            },
            tall: {
                maxWidth: "100%",
                maxHeight: "100%",
                height: "auto",
                objectFit: "contain",
            },
        },
    },
});

export const title = style({
    margin: 0,
    paddingInline: alias.spacing.m,
    textAlign: "center",
});

export const description = style({
    margin: 0,
    paddingInline: alias.spacing.m,
    fontSize: fontSize.m,
    lineHeight: "26px",
    color: vars.text.secondary,
    textAlign: "center",
});
