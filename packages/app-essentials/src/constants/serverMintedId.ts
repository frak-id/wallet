/**
 * Namespace for anonymous ids the backend mints itself, when a Shopify order
 * resolves to an identity group holding no anonymous node.
 *
 * Frozen: it is baked into `latchServerMintedProof`'s SQL predicate and into
 * rows already written, so it cannot move without a migration.
 */
export const SERVER_MINTED_ID_PREFIX = "frakmint_";

/**
 * Such an id is keyless — no device can prove it — and is not a UUID, so
 * `encodeFrakContextV2` refuses it and it can never ride a share link.
 */
export function isServerMintedId(value: string): boolean {
    return value.startsWith(SERVER_MINTED_ID_PREFIX);
}
