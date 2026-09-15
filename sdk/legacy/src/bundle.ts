/**
 * Retired compatibility surface. Nothing here connects to a wallet.
 *
 * Every entry point returns a promise that never settles. The integrations left
 * on this bundle chain their setup off the first call and log from their own
 * failure branches, so stalling is the only silent outcome: resolving would run
 * their error paths, rejecting would run their catch blocks.
 */

const stalled = <T>(..._args: unknown[]): Promise<T> =>
    new Promise<T>(() => undefined);

export const createIframe = stalled;
export const createIFrameNexusClient = stalled;
export const createIFrameFrakClient = stalled;
export const displayModal = stalled;
export const watchWalletStatus = stalled;
export const referralInteraction = stalled;
