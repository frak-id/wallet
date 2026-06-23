// Shared login layout breakpoint. Plain values (no vanilla-extract styles) so
// both the component styles and the global authentication page styles can derive
// from a single source without pulling component CSS into the global bundle.

// At/above this width the login uses the 50/50 split (hero beside the blue
// panel) with the full-size display headline. Below it collapses to the
// single-column phone design (covers tablet portrait and down). Aligned to the
// DS `desktop` token so tablet landscape gets the split, portrait the phone UI.
const LOGIN_SPLIT_MIN_WIDTH = 1024;

// Media query matching the stacked (single-column) range.
export const loginStackedMedia = `screen and (max-width: ${LOGIN_SPLIT_MIN_WIDTH - 1}px)`;
