import { getClientIdAsync } from "../config/clientId";
import { getWalletUrl } from "../config/environment";
import { sdkConfigStore } from "../config/sdkConfigStore";
import { signProof } from "../identity/sign";

/**
 * Build the wallet `/install` URL for a merchant, carrying this page's own
 * credential so the install is attributed back to it.
 *
 * The proof rides in the fragment (`#p=`), never the query string. `a=` travels
 * without it: the code mint refuses a proofless anonymousId, but the Play Store
 * referrer is built from `a=` alone, so dropping it buys nothing.
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
    const encodedMerchantId = encodeURIComponent(merchantId);
    const tokenParam = checkoutToken
        ? `&checkoutToken=${encodeURIComponent(checkoutToken)}`
        : "";

    const anonymousId = await getClientIdAsync().catch(() => undefined);
    if (!anonymousId)
        return `${walletUrl}/install?m=${encodedMerchantId}${tokenParam}`;

    const proof = await signProof({
        op: "frak-install-v1",
        merchantId,
        anonymousId,
    });
    const base = `${walletUrl}/install?m=${encodedMerchantId}&a=${encodeURIComponent(anonymousId)}${tokenParam}`;

    return proof ? `${base}#p=${encodeURIComponent(proof)}` : base;
}
