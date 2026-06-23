import { vars } from "@frak-labs/design-system/theme";
import { alias } from "@frak-labs/design-system/tokens";
import { style } from "@vanilla-extract/css";

export const textareaMuted = style({
    backgroundColor: vars.surface.muted,
    borderRadius: alias.cornerRadius.m,
    width: "100%",
    paddingBlock: alias.spacing.xs,
    selectors: {
        "&&": {
            border: "none",
            boxShadow: "none",
        },
        // No focus ring, matching the DS `bare` inputs around it.
        "&&:focus-within": {
            boxShadow: "none",
            outline: "none",
        },
    },
});

export const switchRow = style({
    borderRadius: alias.cornerRadius.l,
    backgroundColor: vars.surface.elevated,
});

export const previewWrap = style({
    transition: "opacity 0.3s ease, filter 0.3s ease, transform 0.3s ease",
    // Keep the element on its own compositor layer so text isn't re-snapped to
    // the pixel grid when the scale transition settles (avoids a 1-2px shift).
    willChange: "transform",
    backfaceVisibility: "hidden",
    selectors: {
        "&[data-disabled]": {
            opacity: 0.5,
            filter: "grayscale(1)",
            transform: "scale(0.97)",
            cursor: "not-allowed",
        },
    },
});
