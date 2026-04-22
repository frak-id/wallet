import type { FlowEvents } from "./flow";

/**
 * Listener transaction flow — used only by the legacy modal flow (business
 * app). We track the 3 flow outcomes plus `listener_tx_mobile_app_not_found`
 * so we keep visibility on mobile app adoption issues during tx signing.
 *
 * Note: `listener_tx_abandoned` is emitted by `startFlow` when the modal
 * unmounts before success/failure. We don't dashboard it but accept the
 * dead event name in the map.
 */
type ListenerTxFlowExtras = {
    tx_count?: number;
    is_mobile_pairing?: boolean;
    hash?: string;
};

type ListenerTxFlow = FlowEvents<"listener_tx", ListenerTxFlowExtras>;

type ListenerTxMobileEvents = {
    listener_tx_mobile_app_not_found: {
        flow_id?: string;
    };
};

export type ListenerTxEventMap = ListenerTxFlow & ListenerTxMobileEvents;
