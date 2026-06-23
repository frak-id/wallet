import type { ControllerFieldState } from "react-hook-form";

/**
 * Whether a field's validation error should be shown: it has an error AND the
 * user has interacted with it (touched or edited). Keeps the wizard's
 * "don't nag a pristine field" rule defined in one place.
 */
export function shouldShowError(fieldState: ControllerFieldState): boolean {
    return !!fieldState.error && (fieldState.isTouched || fieldState.isDirty);
}
