/**
 * How a page reachable from a native host's web view decides it is embedded.
 *
 * Every route the SDK's sheet can navigate to reads this and nothing else.
 * That is the whole point of the module existing: `/sharing` and `/install`
 * used to answer the question differently — `/sharing` read an `embed` param,
 * `/install` inferred a host from the mere presence of `returnScheme` — so the
 * same web view, one navigation apart, could render one page host-embedded and
 * the next one not. Presentation that depends on a per-route reading of the
 * URL drifts the moment a route is added, which is exactly what happened.
 *
 * Deliberately NOT a host-capability check. `returnScheme` still decides
 * whether outcomes can be reported back, and the two are separate questions: a
 * host could embed a page it does not want callbacks from.
 */

/** The only value `embed` currently takes. */
export const EMBED_NATIVE = "native";

export type HostEmbed = typeof EMBED_NATIVE;

/**
 * Decode the `embed` param.
 *
 * An enum rather than a boolean flag: a second embedding vehicle (an iframe
 * host, a webview on another platform with different chrome) costs a value
 * here instead of another flag to cross-check against this one.
 *
 * The router parses search values as JSON, so a numeric-looking value would
 * arrive as a `number`. Only the exact string is accepted, since the set is
 * closed — anything else is `undefined`, i.e. a plain web visit.
 */
export function decodeHostEmbed(raw: unknown): HostEmbed | undefined {
    return raw === EMBED_NATIVE ? EMBED_NATIVE : undefined;
}

/**
 * Whether a native host draws the chrome around this page.
 *
 * The routes that care use this to drop their own header and backdrop
 * dismissal, both of which would be a second set of controls inside the host's
 * — and in the header's case a dead one, since its close button calls
 * `window.close()`, which a web view does not honour.
 */
export function isHostEmbedded(embed: unknown): boolean {
    return decodeHostEmbed(embed) !== undefined;
}
