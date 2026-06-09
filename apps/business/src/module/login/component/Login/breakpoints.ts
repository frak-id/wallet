// Shared login layout breakpoint. Plain values (no vanilla-extract styles) so
// both the component styles and the global authentication page styles can derive
// from a single source without pulling component CSS into the global bundle.

// Below this width the fixed split (515px hero beside the 720px panel) can no
// longer fit, so the login collapses to a scrollable single column. Wider than
// the DS `desktop` (1024px) token, which is too narrow for this layout.
export const LOGIN_SPLIT_MIN_WIDTH = 1280;

// Media query matching the stacked (single-column) range.
export const loginStackedMedia = `screen and (max-width: ${LOGIN_SPLIT_MIN_WIDTH - 1}px)`;
