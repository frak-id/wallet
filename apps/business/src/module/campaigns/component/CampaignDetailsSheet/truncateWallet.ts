/** Shortens a wallet address to `0x742d…f0bEb0` for compact display. */
export function truncateWallet(wallet: string) {
    // Short enough that head+tail would overlap — show as-is.
    if (wallet.length <= 13) {
        return wallet;
    }
    return `${wallet.slice(0, 6)}…${wallet.slice(-6)}`;
}
