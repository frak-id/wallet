/**
 * Save-section keys, shared with `useCustomizeSection` so a rename cannot
 * desync a panel's registration from the discard-guard exemption below.
 */
export const SECTION_KEYS = {
    identity: "identity",
    sharing: "default-sharing",
    defaultComponents: "default-components",
} as const;

/** Sections rendered above the placement selector, so they survive a tab change. */
const ALWAYS_MOUNTED: Record<string, true> = {
    [SECTION_KEYS.identity]: true,
    [SECTION_KEYS.sharing]: true,
};

/**
 * Whether switching placement tab would discard edits. Only sections below the
 * selector unmount, so the always-mounted ones keep theirs and must not arm the
 * prompt.
 */
export function hasDiscardableSectionChanges(
    dirtySections: Record<string, boolean>
): boolean {
    return Object.entries(dirtySections).some(
        ([key, isDirty]) => isDirty && !ALWAYS_MOUNTED[key]
    );
}
