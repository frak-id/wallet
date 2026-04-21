import type { FlowEvents } from "./flow";

type TxBaseProps = {
    tx_count?: number;
    flow_id?: string;
};

type ListenerTxFlowExtras = {
    tx_count?: number;
    is_mobile_pairing?: boolean;
    hash?: string;
};

type ListenerTxFlow = FlowEvents<"listener_tx", ListenerTxFlowExtras>;

type ListenerTxMidFlowEvents = {
    listener_tx_submitted: TxBaseProps;
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

export type ListenerTxEventMap = ListenerTxFlow & ListenerTxMidFlowEvents;
