// Plain values (no vanilla-extract styles) so the component styles and the
// global authentication page styles share one source without pulling component
// CSS into the global bundle. Aligned to the DS `desktop` token.
const LOGIN_SPLIT_MIN_WIDTH = 1024;

export const loginStackedMedia = `screen and (max-width: ${LOGIN_SPLIT_MIN_WIDTH - 1}px)`;
