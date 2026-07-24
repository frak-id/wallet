import { style } from "@vanilla-extract/css";
import { vars } from "../theme.css";
import { alias, brand, fontSize } from "../tokens.css";
import {
    FIELD_HINT_LINE_HEIGHT,
    FIELD_LABEL_LINE_HEIGHT,
} from "./fieldMetrics";

/**
 * Composed labeled-field label + hint. Shared by `Input`, `TextArea`, and
 * `FieldLabel` — the column layout is a `Stack` owned by each consumer.
 */
export const fieldLabel = style({
    fontSize: fontSize.s,
    lineHeight: `${FIELD_LABEL_LINE_HEIGHT}px`,
    fontWeight: brand.typography.fontWeight.medium,
    color: vars.text.secondary,
    paddingInline: alias.spacing.m,
});

export const fieldHint = style({
    fontSize: fontSize.xs,
    lineHeight: `${FIELD_HINT_LINE_HEIGHT}px`,
    fontWeight: brand.typography.fontWeight.regular,
    color: vars.text.tertiary,
    paddingInline: alias.spacing.m,
});
