/** The `/r/<CODE>` link: `/install?ref=` in a browser, the app's own deep link once it is installed. */
export function referralLink(code: string): string {
    const walletUrl = process.env.FRAK_WALLET_URL ?? "https://wallet.frak.id";
    return `${walletUrl}/r/${code}`;
}

/** The link as it reads on screen, without its scheme. */
export function displayReferralLink(link: string): string {
    return link.replace(/^https?:\/\//, "");
}
