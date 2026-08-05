/**
 * CSS custom properties a native host injects into its own web view.
 *
 * These are the *only* channel by which the SDK's sharing sheet tells the
 * hosted pages what its chrome looks like. They are not set by any stylesheet
 * in this repo — they arrive from `SharingHostStyle` on the Android side, via
 * `WebViewCompat.addDocumentStartJavaScript` scoped to the wallet origin, so
 * every route that web view loads gets them without knowing it.
 *
 * That origin scoping is the point. The radius used to be a `?cornerRadius=`
 * query param on `/sharing`, which meant `/install` — the very next page the
 * same web view loads when the install CTA is pressed — never got it and
 * squared its corners off mid-flow. A param is addressed to a route; a
 * document-start script is addressed to an origin.
 *
 * Every consumer MUST supply a fallback. Unset is the web case, and the
 * fallback is the appearance the page has always had.
 *
 * Plain string constants rather than `createVar()`: the names are a contract
 * with native code that cannot read a vanilla-extract-hashed identifier.
 * Renaming either of these is a cross-repository change — grep `sdk/android`.
 */
export const hostSheetVar = {
    /**
     * Radius, as a CSS length, for the top corners of whatever container fills
     * the host's sheet. Fallback: `0px`.
     */
    topRadius: "--frak-host-top-radius",

    /**
     * Page background. A host sets `transparent` so the corners rounded by
     * `topRadius` cut through to its own scrim rather than to an opaque
     * rectangle. Fallback: the normal surface colour.
     *
     * Both properties are needed together: a `body` background propagates to
     * the document canvas, which no `border-radius` clips, so a radius without
     * a transparent surface rounds nothing visible.
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

/**
 * `border-radius` rounding only the top two corners to the host's radius.
 *
 * Square on the web, where the property is unset.
 */
export const hostSheetTopRadius: string = `${hostSheet(
    hostSheetVar.topRadius,
    "0px"
)} ${hostSheet(hostSheetVar.topRadius, "0px")} 0 0`;
