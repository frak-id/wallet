import { getClientIdAsync } from "../config/clientId";
import { getWalletUrl } from "../config/environment";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { compactUuid } from "../identity/compactId";
import { signProof } from "../identity/sign";

/**
 * Build the wallet install URL (`/i`) for a merchant, carrying this page's own
 * credential so the install is attributed back to it. UUIDs travel as 22-char
 * compact ids; the proof rides in the fragment (`#p=`), never the query. `a=` is
 * dropped only when a proof is attached (the wallet hashes the id from its public
 * key); a proofless link keeps it, since the Play Store referrer is built from it.
 *
 * @param params.merchantId - Merchant to attribute the install to; defaults to `sdkConfigStore.resolveMerchantId()`
 * @param params.checkoutToken - Order token; the mint accepts it without a proof
 * @returns The install URL, or `undefined` when no merchant id resolves
 */
export async function getInstallUrl({
    merchantId: explicitMerchantId,
    checkoutToken,
}: {
    merchantId?: string;
    checkoutToken?: string;
} = {}): Promise<string | undefined> {
    const merchantId =
        explicitMerchantId ?? (await sdkConfigStore.resolveMerchantId());
    if (!merchantId) return undefined;

    const walletUrl = getWalletUrl();
    const merchantParam = encodeURIComponent(
        compactUuid(merchantId) ?? merchantId
    );
    const tokenParam = checkoutToken
        ? `&checkoutToken=${encodeURIComponent(checkoutToken)}`
        : "";
    const base = `${walletUrl}/i?m=${merchantParam}`;

    const anonymousId = await getClientIdAsync().catch(() => undefined);
    if (!anonymousId) return `${base}${tokenParam}`;

    // Signed bytes use the canonical hyphenated ids, never the compact URL form.
    const proof = await signProof({
        op: "frak-install-v1",
        merchantId,
        anonymousId,
    });
    if (proof) return `${base}${tokenParam}#p=${encodeURIComponent(proof)}`;

    const anonymousParam = encodeURIComponent(
        compactUuid(anonymousId) ?? anonymousId
    );
    return `${base}&a=${anonymousParam}${tokenParam}`;
}
