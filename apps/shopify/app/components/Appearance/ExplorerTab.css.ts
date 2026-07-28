import { style } from "@vanilla-extract/css";

/**
 * Two-column layout once the window is wide enough: the form card and the
 * phone preview become flex siblings so the preview always sits beside the
 * form and can never overlap it (a viewport-fixed preview collides with the
 * card as Polaris re-centres it on wide screens).
 */
export const form = style({
    "@media": {
        "(min-width: 1200px)": {
            display: "flex",
            alignItems: "flex-start",
            gap: 40,
        },
    },
});

/**
 * Form column. Grows to fill the space left of the preview but caps at a
 * comfortable reading width so it neither collapses nor stretches too wide.
 */
export const formCol = style({
    "@media": {
        "(min-width: 1200px)": {
            flex: "1 1 0",
            minWidth: 0,
            maxWidth: 640,
        },
    },
});

/**
 * Phone preview column. Beside the form and sticky on wide screens; on narrow
 * admin windows it stacks (centred) under the form instead of hiding, so the
 * merchant still sees the live preview at every width.
 */
export const preview = style({
    // Base (narrow admin, and the fractional gap between the breakpoints, e.g.
    // 1199.5px on zoom/HiDPI): stack the preview centred under the form.
    display: "flex",
    // Column so the disabled-state hint sits under the phone, not beside it.
    flexDirection: "column",
    alignItems: "center",
    marginBlockStart: 24,
    "@media": {
        "(min-width: 1200px)": {
            // Two-column: sit beside the form and stick while it scrolls.
            marginBlockStart: 0,
            flexShrink: 0,
            position: "sticky",
            top: 20,
            alignSelf: "flex-start",
        },
    },
});

/**
 * Info-icon + caption row under the phone, shown only while the listing is
 * disabled. Always readable (unlike a lone corner icon) and doubles as the
 * hover/focus trigger for the Polaris tooltip explaining the dimmed state.
 */
export const previewHint = style({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    marginBlockStart: 8,
    // Signal that hovering/focusing reveals more.
    cursor: "help",
});
