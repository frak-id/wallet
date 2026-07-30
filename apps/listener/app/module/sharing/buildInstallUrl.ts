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
    baseUrl,
    merchantId,
    clientId,
    installProof,
}: {
    baseUrl: string;
    merchantId: string;
    clientId: string;
    installProof?: string;
}): string {
    const url = `${baseUrl}/install?m=${encodeURIComponent(merchantId)}&a=${encodeURIComponent(clientId)}`;
    return installProof ? `${url}#p=${encodeURIComponent(installProof)}` : url;
}
