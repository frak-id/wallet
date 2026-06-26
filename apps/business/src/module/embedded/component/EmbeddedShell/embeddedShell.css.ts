import { vars } from "@frak-labs/design-system/theme";
import { globalStyle, style } from "@vanilla-extract/css";

// Paint the full viewport (html) so the embedded popup background covers every
// edge regardless of content height. `minHeight: 100dvh` forces the html box to
// fill the viewport — otherwise it only spans the (short) content height and the
// background leaves white gaps below/around it.
globalStyle("html:has(main[data-embedded-layout])", {
    minHeight: "100dvh",
    color: vars.text.primary,
    backgroundColor: vars.surface.background2,
    // The app reserves a stable scrollbar gutter globally (to avoid layout shift
    // under Radix overlays). The embedded popup has no such overlays, and the
    // reserved gutter leaves an unpainted strip on the right — opt out of it.
    scrollbarGutter: "auto",
});

// Constrain + center the embedded content (modal-like popup width).
export const main = style({
    maxWidth: 440,
    margin: "0 auto",
    padding: "32px 20px",
});
