import type { EventMap, FlowEndExtras, FlowOutcome } from "./events";
import { flowOutcomeToEventName } from "./events";
import { trackEvent } from "./trackEvent";

export type Flow = {
    readonly flowId: string;
    readonly flowName: string;
    readonly ended: boolean;
    track<K extends keyof EventMap>(event: K, properties?: EventMap[K]): void;
    end(outcome: FlowOutcome, extras?: FlowEndExtras): void;
};

function generateFlowId(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    )
        return crypto.randomUUID();
    return `flow_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Start a scoped flow that stitches a multi-step funnel via a local `flow_id`.
 *
 * Two guards prevent real bugs cheaply:
 *  - `end()` is idempotent — retries / double-submits don't emit twice
 *  - `track()` after `end()` drops silently — late async callbacks can't leak
 *    events without flow context
 *
 * `flow_id` lives in the closure, never in OpenPanel global properties, so
 * concurrent flows (e.g. token-send + an embedded wallet opened by a push
 * notification) don't cross-contaminate.
 */
export function startFlow(flowName: string): Flow {
    const flowId = generateFlowId();
    const startedAt = Date.now();
    let ended = false;

    trackEvent("flow_started", {
        flow_name: flowName,
        flow_id: flowId,
    });

    return {
        flowId,
        flowName,
        get ended() {
            return ended;
        },
        track(event, properties) {
            if (ended) return;
            trackEvent(event, {
                ...(properties as Record<string, unknown> | undefined),
                flow_id: flowId,
            } as EventMap[typeof event]);
        },
        end(outcome, extras) {
            if (ended) return;
            ended = true;
            trackEvent(flowOutcomeToEventName(outcome), {
                flow_name: flowName,
                flow_id: flowId,
                duration_ms: Date.now() - startedAt,
                ...extras,
            });
        },
    };
}
