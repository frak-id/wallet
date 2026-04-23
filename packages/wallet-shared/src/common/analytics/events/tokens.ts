import type { FlowEvents } from "./flow";

export type TokensSendAmountBucket = "<1" | "1-10" | "10-100" | ">100";

/**
 * Intentionally minimal — regular token transfer is a low-priority KPI
 * (users are funneled to Monerium instead). We keep just the flow outcomes
 * so we can compute a basic success rate.
 *
 * Note: `tokens_send_abandoned` is part of the emitted event names (via
 * `FlowEvents`) because `startFlow` ends unfinished flows as `abandoned`
 * on unmount. We don't instrument a dashboard for it and accept the dead
 * event name in the map.
 */
type TokensSendFlowExtras = {
    prefill_address?: boolean;
    token_symbol?: string;
    amount_bucket?: TokensSendAmountBucket;
};

export type TokensEventMap = FlowEvents<"tokens_send", TokensSendFlowExtras>;
