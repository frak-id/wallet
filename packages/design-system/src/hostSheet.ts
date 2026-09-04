/**
 * CSS custom properties a native host injects into its own web view (see
 * `SharingHostStyle` in `sdk/android`). Never set by a stylesheet here, so every
 * consumer must supply a fallback — unset is the plain web appearance. Plain
 * strings, not `createVar()`: the names are a contract with native code.
 */
export const hostSheetVar = {
    topRadius: "--frak-host-top-radius",

    /**
     * Page background. A host sets `transparent` so the corners rounded by
     * `topRadius` cut through to its own scrim; a radius without a transparent
     * surface rounds nothing visible.
     */
    surface: "--frak-host-surface",
} as const;

/** `var(--name, fallback)` for one of the properties above. */
export function hostSheet(
    name: (typeof hostSheetVar)[keyof typeof hostSheetVar],
    fallback: string
): string {
    return `var(${name}, ${fallback})`;
}

/** `border-radius` rounding only the top two corners to the host's radius. */
export const hostSheetTopRadius: string = `${hostSheet(
    hostSheetVar.topRadius,
    "0px"
)} ${hostSheet(hostSheetVar.topRadius, "0px")} 0 0`;
