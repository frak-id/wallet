import { PLAY_STORE_URL } from "../common/utils/storeUrls";

/**
 * Build the `/install` link.
 *
 * `m`/`a` stay search params — non-sensitive routing info the install-code
 * backend needs server-side. The `frak-install-v1` proof is appended as a
 * URL fragment (`#p=`), never a search param: fragments aren't sent to
 * servers, keeping the proof out of access logs, `Referer` headers, and
 * analytics auto-capture.
 */
export function buildInstallUrl({
    baseUrl = "",
    merchantId,
    clientId,
    installProof,
}: {
    /** Omit for a same-origin link. */
    baseUrl?: string;
    merchantId: string;
    clientId: string;
    installProof?: string;
}): string {
    const url = `${baseUrl}/install?m=${encodeURIComponent(merchantId)}&a=${encodeURIComponent(clientId)}`;
    return installProof ? `${url}#p=${encodeURIComponent(installProof)}` : url;
}

/**
 * Build the Play Store URL carrying the install attribution as its referrer.
 *
 * `proof` is additive and appended only when present; `merchantId` and
 * `anonymousId` keep their positions so a binary parsing the referrer with
 * `URLSearchParams` reads exactly what it reads today and silently ignores
 * the extra key.
 */
export function buildPlayStoreInstallUrl({
    merchantId,
    anonymousId,
    installProof,
}: {
    merchantId: string;
    anonymousId: string;
    installProof?: string;
}): string {
    const referrer = `merchantId=${merchantId}&anonymousId=${anonymousId}${
        installProof ? `&proof=${installProof}` : ""
    }`;
    return `${PLAY_STORE_URL}&referrer=${encodeURIComponent(referrer)}`;
}
