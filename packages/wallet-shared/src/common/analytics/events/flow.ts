/**
 * Flow outcome -> event suffix. A flow named `auth_login` emits:
 *   - `auth_login_started` on `startFlow("auth_login", …)`
 *   - `auth_login_succeeded` on `flow.end("succeeded", …)`
 *   - `auth_login_failed` / `_abandoned` likewise.
 *
 * Domain-prefixed names make OpenPanel dashboards filter naturally
 * (one event name per flow outcome, no cross-flow contamination).
 *
 * `cancelled` is intentionally not part of this union: in practice every
 * user-facing cancel we've instrumented so far maps cleanly to either a
 * component unmount (`abandoned`) or an error (`failed`). Reintroduce it
 * only when a distinct dashboard metric for explicit cancels is needed.
 */
export type FlowOutcome = "succeeded" | "failed" | "abandoned";

type FlowBaseProps = {
    flow_name: string;
    flow_id: string;
};

export type FlowStartExtras = Record<string, unknown>;

export type FlowEndExtras = Record<string, unknown> & {
    last_step?: string;
    error_type?: string;
    error_message?: string;
};

type FlowStartedProps<E extends Record<string, unknown>> = FlowBaseProps & E;
type FlowEndedProps<E extends Record<string, unknown>> = FlowBaseProps &
    E &
    FlowEndExtras & { duration_ms: number };

/**
 * Helper for declaring flow events in a domain event map.
 *
 * Each flow emits 4 events sharing `flow_name` + `flow_id`:
 *   `${Name}_started` on startFlow → carries start extras
 *   `${Name}_{outcome}` on flow.end → carries duration_ms + end extras
 *
 * @example
 * ```ts
 * type AuthLoginFlow = FlowEvents<"auth_login", { method?: "global" | "specific" }>;
 * // auth_login_started:   { flow_name, flow_id, method? }
 * // auth_login_succeeded: { flow_name, flow_id, duration_ms, method?, ... }
 * // auth_login_failed:    { flow_name, flow_id, duration_ms, method?, error_type?, ... }
 * // auth_login_abandoned: same shape as _succeeded
 * ```
 */
export type FlowEvents<
    Name extends string,
    Extras extends Record<string, unknown> = Record<string, never>,
> = { [K in `${Name}_started`]: FlowStartedProps<Extras> } & {
    [K in `${Name}_succeeded`]: FlowEndedProps<Extras>;
} & { [K in `${Name}_failed`]: FlowEndedProps<Extras> } & {
    [K in `${Name}_abandoned`]: FlowEndedProps<Extras>;
};
