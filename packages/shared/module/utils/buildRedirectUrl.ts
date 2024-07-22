/**
 * Build the redirect URL for the Nexus Wallet register page
 * @param nexusWalletUrl
 * @param redirectUrl
 */
export function buildRedirectUrl(nexusWalletUrl: string, redirectUrl: string) {
    const outputUrl = new URL(nexusWalletUrl);
    outputUrl.pathname = "/sso";
    outputUrl.searchParams.set("redirectUrl", encodeURIComponent(redirectUrl));
    return outputUrl.toString();
}
