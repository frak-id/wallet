import type { ReactNode } from "react";
import { useId } from "react";

type UseFieldIdsOptions = {
    id?: string;
    hint?: ReactNode;
    ariaDescribedBy?: string;
};

/**
 * Derives the field `id` / hint `id` / `aria-describedby` used by `Input`
 * and `TextArea` to wire their control to a composed label and hint.
 */
export function useFieldIds({ id, hint, ariaDescribedBy }: UseFieldIdsOptions) {
    const generatedId = useId();
    const fieldId = id ?? generatedId;
    const hintId = hint ? `${fieldId}-hint` : undefined;
    const describedBy =
        [ariaDescribedBy, hintId].filter(Boolean).join(" ") || undefined;

    return { fieldId, hintId, describedBy };
}
