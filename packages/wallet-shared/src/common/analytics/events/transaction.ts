/**
 * Listener transaction event map.
 *
 * This is the partner-initiated transaction flow that runs inside the
 * listener iframe (triggered by `frak_displayModal` with `sendTransaction`
 * step). It is distinct from the wallet-native `tokens_send_*` flow: those
 * events live in the wallet app and cover user-initiated sends.
 *
 * The listener flow is wired through `startFlow("listener_transaction")` so
 * every event shares a `flow_id`.
 */
type TxBaseProps = {
    tx_count: number;
    flow_id?: string;
};

export type ListenerTxEventMap = {
    listener_tx_viewed: TxBaseProps & {
        is_mobile_pairing: boolean;
    };
    listener_tx_submitted: TxBaseProps;
    listener_tx_succeeded: TxBaseProps & {
        hash: string;
    };
    listener_tx_failed: TxBaseProps & {
        error_type?: string;
        reason?: string;
    };

    // Mobile-specific (distant-webauthn / deep link flow)
    listener_tx_mobile_deeplink_clicked: {
        retry: boolean;
        flow_id?: string;
    };
    listener_tx_mobile_timeout: {
        flow_id?: string;
    };
    listener_tx_mobile_app_not_found: {
        flow_id?: string;
    };
};
