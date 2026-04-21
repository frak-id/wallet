import type { AuthEventMap } from "./auth";
import type { FlowEventMap } from "./flow";
import type { SharingEventMap } from "./sharing";

export type { AuthEventMap } from "./auth";
export type { FlowEndExtras, FlowEventMap, FlowOutcome } from "./flow";
export { flowOutcomeToEventName } from "./flow";
export type { SharingEventMap } from "./sharing";

/**
 * Single merged event map used for typed tracking across the wallet +
 * listener apps. Add app-specific domains here as new phases land
 * (tokens_*, onboarding_*, modal_*, embedded_wallet_*, …).
 */
export type EventMap = AuthEventMap & SharingEventMap & FlowEventMap;
