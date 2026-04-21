import type { FlowEvents } from "./flow";

export type TokensSendValidationField = "address" | "amount";
export type TokensSendAmountBucket = "<1" | "1-10" | "10-100" | ">100";

type TokensSendBaseProps = {
    flow_id?: string;
};

type TokensSendFlowExtras = {
    prefill_address?: boolean;
    token_symbol?: string;
    amount_bucket?: TokensSendAmountBucket;
};

type TokensSendFlow = FlowEvents<"tokens_send", TokensSendFlowExtras>;

type TokensSendMidFlowEvents = {
    tokens_send_token_changed: TokensSendBaseProps & { token_symbol: string };
    tokens_send_max_clicked: TokensSendBaseProps & { token_symbol: string };
    tokens_send_validation_failed: TokensSendBaseProps & {
        field: TokensSendValidationField;
        error_type: string;
    };
    tokens_send_biometric_requested: TokensSendBaseProps | undefined;
    tokens_send_biometric_rejected: TokensSendBaseProps | undefined;
    tokens_send_submitted: TokensSendBaseProps & {
        token_symbol: string;
        amount_bucket: TokensSendAmountBucket;
    };
};

export type TokensEventMap = TokensSendFlow & TokensSendMidFlowEvents;
