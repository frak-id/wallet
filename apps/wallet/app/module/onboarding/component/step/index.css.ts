import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const body = style({
    display: "flex",
    flexDirection: "column",
    gap: alias.spacing.m,
    // Size to content (not flex:1) so tall content extends the scroll area
    // instead of being trapped under the footer.
    flexShrink: 0,
});

// Gap between the Back arrow row and the hero image (steps with `onBack`).
export const bodyWithBack = style({
    marginTop: alias.spacing.m,
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
