import { style } from "@vanilla-extract/css";

/**
 * Wrapper for a merchant preview (card or phone) that dims and slightly
 * shrinks when the previewed feature is disabled. Toggle via a `data-disabled`
 * attribute on the element. Shared by the business dashboard and the Shopify
 * app so the disabled affordance stays identical across surfaces.
 */
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
