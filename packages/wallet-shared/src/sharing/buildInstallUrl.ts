import { PLAY_STORE_URL } from "../common/utils/storeUrls";

/**
 * Build the `/install` link (README §4.4).
 *
 * `m`/`a` stay search params — they are non-sensitive routing info the
 * install-code backend already needs server-side. The `frak-install-v1`
 * proof is appended as a URL fragment (`#p=`), never a search param (§2.2):
 * fragments are not sent to servers, so this keeps the proof out of access
 * logs, `Referer` headers, and analytics auto-capture.
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
 * Build the Play Store URL carrying the install attribution as its referrer
 * (DUAL-ARM-PLAN.md D-C/WS-3 W2).
 *
 * `proof` is additive and appended only when present; `merchantId` and
 * `anonymousId` keep their positions so a binary parsing the referrer with
 * `URLSearchParams` (pre-W3) reads exactly what it reads today and silently
 * ignores the extra key.
 *
 * Measured against the real `frak-install-v1` golden fixture (plan D-C): the
 * proof is ~184 chars (base64url has no reserved chars, so encoding is a
 * no-op on it) and the full dual string ~281, 27% of the Play referrer's
 * ~1024-char cap. Re-measure if more keys are ever added.
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
