/**
 * Save-section keys, shared with `useCustomizeSection` so a rename cannot
 * desync a panel's registration from the discard-guard exemption below.
 */
export const SECTION_KEYS = {
    identity: "identity",
    sharing: "default-sharing",
    ambassador: "ambassador-page",
    defaultComponents: "default-components",
} as const;

/** Sections outside the components card, so they survive a placement change. */
const ALWAYS_MOUNTED: Record<string, true> = {
    [SECTION_KEYS.identity]: true,
    [SECTION_KEYS.sharing]: true,
    [SECTION_KEYS.ambassador]: true,
};

/**
 * Whether switching placement tab would discard edits. Every section outside
 * this list unmounts on a placement change; the always-mounted ones keep their
 * edits and must not arm the prompt.
 */
export function hasDiscardableSectionChanges(
    dirtySections: Record<string, boolean>
): boolean {
    return Object.entries(dirtySections).some(
        ([key, isDirty]) => isDirty && !ALWAYS_MOUNTED[key]
    );
}
