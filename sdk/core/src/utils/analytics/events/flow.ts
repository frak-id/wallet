/**
 * SDK-side flow outcome map. Mirrors wallet-shared's flow events but keeps
 * the SDK isolated (its own OpenPanel client, own bundle constraints).
 * `flow_id` is scoped to each flow instance, never a global property.
 */
export type SdkFlowOutcome =
    | "succeeded"
    | "failed"
    | "abandoned"
    | "cancelled";

export type SdkFlowEndExtras = Record<string, unknown> & {
    last_step?: string;
    error_type?: string;
    error_message?: string;
};

type FlowBaseProps = {
    flow_name: string;
    flow_id: string;
};

type FlowEndProps = FlowBaseProps & {
    duration_ms: number;
} & SdkFlowEndExtras;

export type SdkFlowEventMap = {
    flow_started: FlowBaseProps;
    flow_succeeded: FlowEndProps;
    flow_failed: FlowEndProps;
    flow_abandoned: FlowEndProps;
    flow_cancelled: FlowEndProps;
};

export function sdkFlowOutcomeToEventName(
    outcome: SdkFlowOutcome
): keyof SdkFlowEventMap {
    switch (outcome) {
        case "succeeded":
            return "flow_succeeded";
        case "failed":
            return "flow_failed";
        case "abandoned":
            return "flow_abandoned";
        case "cancelled":
            return "flow_cancelled";
    }
}
