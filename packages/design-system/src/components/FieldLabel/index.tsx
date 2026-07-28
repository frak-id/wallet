import clsx from "clsx";
import type { ReactNode } from "react";
import { Box } from "../Box";
import { fieldHint, fieldLabel } from "../fieldChrome.css";
import { FIELD_LABEL_LINE_HEIGHT } from "../fieldMetrics";
import { Stack } from "../Stack";
import * as styles from "./fieldLabel.css";

type FieldLabelProps = {
    /** Label rendered above the control (14/22 medium secondary, 16px inset). */
    label?: ReactNode;
    /** Hint rendered below the control (12/20 tertiary, 16px inset). */
    hint?: ReactNode;
    /**
     * `for` attribute of the label. Point it at the control's `id` for an
     * accessible association — the caller owns the control's `id`.
     */
    htmlFor?: string;
    /**
     * Id for the hint node so the control can reference it via
     * `aria-describedby`. Defaults to `${htmlFor}-hint` when `htmlFor` is set.
     */
    hintId?: string;
    /**
     * Reserve this many lines of label height (bottom-anchored) so fields laid
     * out side by side stay aligned when one label wraps and another doesn't.
     * Only applies when `label` is set.
     */
    reserveLabelLines?: number;
    className?: string;
    /** The control being labelled. */
    children: ReactNode;
};

/**
 * Standalone field label + hint block for controls that can't consume the
 * composed `label`/`hint` props on DS `Input`/`TextArea` — selects, dropzones,
 * number steppers, and side-by-side columns needing aligned labels. Matches the
 * DS field spec: 8px label→control, 4px control→hint, 16px inset. Association is
 * caller-driven: pass `htmlFor` and give the control the matching `id`.
 */
export function FieldLabel({
    label,
    hint,
    htmlFor,
    hintId,
    reserveLabelLines,
    className,
    children,
}: FieldLabelProps) {
    const resolvedHintId =
        hint && htmlFor ? (hintId ?? `${htmlFor}-hint`) : hintId;
    const reserveStyle = reserveLabelLines
        ? { minHeight: `${reserveLabelLines * FIELD_LABEL_LINE_HEIGHT}px` }
        : undefined;

    return (
        <Stack space="xs" className={className}>
            {label ? (
                <Box
                    as="label"
                    htmlFor={htmlFor}
                    className={clsx(
                        fieldLabel,
                        reserveLabelLines ? styles.labelReserve : undefined
                    )}
                    style={reserveStyle}
                >
                    {label}
                </Box>
            ) : null}
            {hint ? (
                <Stack space="xxs">
                    {children}
                    <Box as="span" id={resolvedHintId} className={fieldHint}>
                        {hint}
                    </Box>
                </Stack>
            ) : (
                children
            )}
        </Stack>
    );
}
