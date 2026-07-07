/**
 * Shared field label/hint line-heights (px).
 *
 * These are the single source of truth for the composed labeled-field chrome
 * rendered by `Input`, `TextArea`, and `FieldLabel`. The label value is also
 * consumed by `FieldLabel`'s `reserveLabelLines` calc, so centralising it keeps
 * the reserved slot height and the rendered label line-height from drifting
 * apart across those components.
 */
export const FIELD_LABEL_LINE_HEIGHT = 22;
export const FIELD_HINT_LINE_HEIGHT = 20;
