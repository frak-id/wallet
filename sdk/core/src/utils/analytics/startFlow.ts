import type { FrakClient } from "../../types";
import type { SdkEventMap, SdkFlowEndExtras, SdkFlowOutcome } from "./events";
import { sdkFlowOutcomeToEventName } from "./events";
import { trackEvent } from "./trackEvent";

export type SdkFlow = {
    readonly flowId: string;
    readonly flowName: string;
    readonly ended: boolean;
    track<K extends keyof SdkEventMap>(
        event: K,
        properties?: SdkEventMap[K]
    ): void;
    end(outcome: SdkFlowOutcome, extras?: SdkFlowEndExtras): void;
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
 * SDK-side scoped flow. Same guards as the wallet-shared version:
 *  - `end()` is idempotent (retries / double-submits can't double-emit)
 *  - `track()` after `end()` drops silently (late async callbacks can't leak)
 *
 * Kept separate from wallet-shared on purpose: SDK ships with the partner
 * bundle, uses its own OpenPanel client, and cannot import wallet-shared.
 */
export function startFlow(
    client: FrakClient | undefined,
    flowName: string
): SdkFlow {
    const flowId = generateFlowId();
    const startedAt = Date.now();
    let ended = false;

    trackEvent(client, "flow_started", {
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
            trackEvent(client, event, {
                ...(properties as Record<string, unknown> | undefined),
                flow_id: flowId,
            } as SdkEventMap[typeof event]);
        },
        end(outcome, extras) {
            if (ended) return;
            ended = true;
            trackEvent(client, sdkFlowOutcomeToEventName(outcome), {
                flow_name: flowName,
                flow_id: flowId,
                duration_ms: Date.now() - startedAt,
                ...extras,
            });
        },
    };
}
