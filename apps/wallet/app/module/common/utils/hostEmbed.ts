/**
 * How a page reachable from a native host's web view decides it is embedded.
 * Not a host-capability check: `returnScheme` decides whether outcomes can be
 * reported back, which is a separate question.
 */

/** The only value `embed` currently takes. */
export const EMBED_NATIVE = "native";

export type HostEmbed = typeof EMBED_NATIVE;

/** Decode the `embed` search param; anything unrecognised means a plain web visit. */
export function decodeHostEmbed(raw: unknown): HostEmbed | undefined {
    return raw === EMBED_NATIVE ? EMBED_NATIVE : undefined;
}

/** Whether a native host draws the chrome around this page. */
export function isHostEmbedded(embed: unknown): boolean {
    return decodeHostEmbed(embed) !== undefined;
}
