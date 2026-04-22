import type {
    EventMap,
    FlowEndExtras,
    FlowOutcome,
    FlowStartExtras,
} from "./events";
import { trackEvent } from "./trackEvent";

/**
 * Flow base names extracted from EventMap keys ending in `_started`.
 * Enforces that `startFlow(name)` only accepts names with corresponding
 * `${name}_started/_succeeded/_failed/_abandoned/_cancelled` events
 * declared in some domain event map.
 */
export type FlowBaseName = {
    [K in keyof EventMap]: K extends `${infer Base}_started` ? Base : never;
}[keyof EventMap];

export type Flow<Name extends string = string> = {
    readonly flowId: string;
    readonly flowName: Name;
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
 * Start a scoped flow that emits domain-prefixed events.
 *
 * `startFlow("auth_login", { method })` emits `auth_login_started { flow_name, flow_id, method }`.
 * `flow.end("succeeded", { extras })` emits `auth_login_succeeded { flow_name, flow_id, duration_ms, ...extras }`.
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
export function startFlow<Name extends FlowBaseName>(
    flowName: Name,
    startProperties?: FlowStartExtras
): Flow<Name> {
    const flowId = generateFlowId();
    const startedAt = Date.now();
    let ended = false;

    const startedKey = `${flowName}_started` as keyof EventMap;
    trackEvent(startedKey, {
        flow_name: flowName,
        flow_id: flowId,
        ...startProperties,
    } as EventMap[typeof startedKey]);

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
            const endedKey = `${flowName}_${outcome}` as keyof EventMap;
            trackEvent(endedKey, {
                flow_name: flowName,
                flow_id: flowId,
                duration_ms: Date.now() - startedAt,
                ...extras,
            } as EventMap[typeof endedKey]);
        },
    };
}
