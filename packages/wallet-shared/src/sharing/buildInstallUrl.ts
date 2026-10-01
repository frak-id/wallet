import { PLAY_STORE_URL } from "../common/utils/storeUrls";

/**
 * Build the `/install` link, or `null` when no credential is available.
 *
 * `m`/`a`/`checkoutToken` stay search params — the install-code backend reads
 * them server-side. The `frak-install-v1` proof goes in the `#p=` fragment
 * instead, which no server, `Referer` header or analytics capture ever sees.
 */
export function buildInstallUrl({
    baseUrl = "",
    merchantId,
    clientId,
    checkoutToken,
    installProof,
    allowCredentialless = false,
}: {
    /** Omit for a same-origin link. */
    baseUrl?: string;
    merchantId: string;
    clientId?: string;
    /** Shopify credential, for a buyer whose surface holds an order and no client id. */
    checkoutToken?: string;
    installProof?: string;
    /**
     * Build a merchant-only link instead of returning `null`. The destination
     * then renders the store CTA with no code, which is the whole surface for
     * a page that holds no credential to mint one from.
     */
    allowCredentialless?: boolean;
}): string | null {
    if (!(clientId || checkoutToken || allowCredentialless)) return null;

    const params = [`m=${encodeURIComponent(merchantId)}`];
    if (clientId) params.push(`a=${encodeURIComponent(clientId)}`);
    if (checkoutToken) {
        params.push(`checkoutToken=${encodeURIComponent(checkoutToken)}`);
    }

    const url = `${baseUrl}/install?${params.join("&")}`;
    return installProof ? `${url}#p=${encodeURIComponent(installProof)}` : url;
}

/**
 * Build the Play Store URL carrying the install attribution as its referrer.
 *
 * Every key is appended only when present, in a fixed order, so a binary
 * parsing the referrer with `URLSearchParams` silently ignores the extras.
 */
export function buildPlayStoreInstallUrl({
    merchantId,
    anonymousId,
    installProof,
    referralCode,
}: {
    merchantId?: string;
    anonymousId?: string;
    installProof?: string;
    referralCode?: string;
}): string {
    const referrer = [
        merchantId && `merchantId=${merchantId}`,
        anonymousId && `anonymousId=${anonymousId}`,
        installProof && `proof=${installProof}`,
        referralCode && `referralCode=${referralCode}`,
    ]
        .filter(Boolean)
        .join("&");
    return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(referrer)}`;
}
