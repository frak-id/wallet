import type { SdkComponentEventMap } from "./component";
import type { SdkFlowEventMap } from "./flow";
import type { SdkLifecycleEventMap } from "./lifecycle";
import type { SdkReferralEventMap } from "./referral";

export type { SdkComponentEventMap } from "./component";
export type {
    SdkFlowEndExtras,
    SdkFlowEventMap,
    SdkFlowOutcome,
} from "./flow";
export { sdkFlowOutcomeToEventName } from "./flow";
export type {
    SdkHandshakeFailureReason,
    SdkLifecycleEventMap,
} from "./lifecycle";
export type { SdkReferralEventMap } from "./referral";

/**
 * Merged SDK event map. Consumed by the SDK's typed `trackEvent` and
 * `startFlow`. Stays isolated from wallet-shared because the SDK ships in
 * partner bundles (different OpenPanel client id, no wallet-shared
 * dependency allowed — see `packages/wallet-shared/AGENTS.md`).
 */
export type SdkEventMap = SdkLifecycleEventMap &
    SdkComponentEventMap &
    SdkReferralEventMap &
    SdkFlowEventMap;
