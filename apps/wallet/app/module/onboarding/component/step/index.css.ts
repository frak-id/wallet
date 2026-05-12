import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.l,
    flex: 1,
    minHeight: 0,
});

export const heroImage = style({
    display: "block",
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center",
});

export const heroImageCenter = style({
    display: "block",
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
});
