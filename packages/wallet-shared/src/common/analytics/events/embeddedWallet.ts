/**
 * Embedded wallet event map — listener-side events for the iframe embedded
 * wallet view (triggered by `frak_displayEmbeddedWallet`). Tracks display,
 * auth state, and explicit close so engagement KPIs are computable.
 */
type EmbeddedBaseProps = {
    productId?: string;
};

export type EmbeddedWalletEventMap = {
    embedded_wallet_opened: EmbeddedBaseProps & {
        logged_in: boolean;
    };
    embedded_wallet_closed: EmbeddedBaseProps & {
        duration_ms: number;
        logged_in_at_close: boolean;
    };
};
