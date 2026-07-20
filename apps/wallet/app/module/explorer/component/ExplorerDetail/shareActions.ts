// Step-2 primary CTA must never no-op: `handleShare` silently returns when
// `canShare` is false (no native share surface), so fall back to copying
// the link instead of leaving the button dead on desktop.
export function resolvePrimaryShareAction(
    canShare: boolean,
    handleShare: () => void,
    handleCopy: () => void
) {
    return canShare ? handleShare : handleCopy;
}

export function isCreateStepDisabled(isCreating: boolean, isLoading: boolean) {
    return isCreating || isLoading;
}
