/**
 * Embedded wallet event map — listener-side events for the iframe embedded
 * wallet view (triggered by `frak_displayEmbeddedWallet`). Tracks display,
 * auth state, and explicit close so engagement KPIs are computable.
 */
export type EmbeddedWalletEventMap = {
    embedded_wallet_opened: {
        logged_in: boolean;
    };
    embedded_wallet_closed: {
        duration_ms: number;
        logged_in_at_close: boolean;
    };
};
