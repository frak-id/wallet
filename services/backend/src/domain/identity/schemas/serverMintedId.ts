import { HttpError } from "@backend-utils";
import type { IdentityRepository } from "../repositories/IdentityRepository";

/**
 * Namespace reserved for ids the backend mints itself (Gate 2's materialised
 * anonymous node). The value carries an unguessable UUID suffix and the latch
 * predicate matches it exactly, which is what makes latching one safe.
 */
export const SERVER_MINTED_ID_PREFIX = "frakmint_";

export function isServerMintedId(value: string): boolean {
    return value.startsWith(SERVER_MINTED_ID_PREFIX);
}

/**
 * Reject a caller *minting* a node in the reserved namespace. Naming one that
 * already exists is the Gate 2 handoff: `/identity/order-client` publishes the
 * materialised id and the wallet presents it back here.
 */
export async function assertNotMintingServerMintedId(params: {
    value: string;
    merchantId: string;
    identityRepository: IdentityRepository;
}): Promise<void> {
    if (!isServerMintedId(params.value)) return;

    const node = await params.identityRepository.findNodeByIdentity({
        type: "anonymous_fingerprint",
        value: params.value,
        merchantId: params.merchantId,
    });
    if (!node) {
        throw HttpError.badRequest(
            "RESERVED_IDENTITY",
            "anonymousId uses a reserved prefix"
        );
    }
}
