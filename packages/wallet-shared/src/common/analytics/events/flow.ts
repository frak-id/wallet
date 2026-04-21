/**
 * `flow_id` is deliberately scoped to a single flow instance (see
 * `flowLogger.ts`) and is NEVER a global OpenPanel property — concurrent
 * flows (e.g. token-send + an embedded wallet opened by a push notification)
 * must not cross-contaminate.
 */

export type FlowOutcome = "succeeded" | "failed" | "abandoned" | "cancelled";

export type FlowEndExtras = Record<string, unknown> & {
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
} & FlowEndExtras;

export type FlowEventMap = {
    flow_started: FlowBaseProps;
    flow_succeeded: FlowEndProps;
    flow_failed: FlowEndProps;
    flow_abandoned: FlowEndProps;
    flow_cancelled: FlowEndProps;
};

export function flowOutcomeToEventName(
    outcome: FlowOutcome
): keyof FlowEventMap {
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
