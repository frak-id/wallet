import { HttpError } from "@backend-utils";
import { isServerMintedId } from "@frak-labs/app-essentials/constants/serverMintedId";
import type { IdentityRepository } from "../repositories/IdentityRepository";

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
