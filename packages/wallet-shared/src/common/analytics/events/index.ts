import type { AuthEventMap } from "./auth";
import type { EmbeddedWalletEventMap } from "./embeddedWallet";
import type { FlowEventMap } from "./flow";
import type { ListenerMiscEventMap } from "./listener";
import type { ModalEventMap } from "./modal";
import type { SharingEventMap } from "./sharing";
import type { ListenerTxEventMap } from "./transaction";

export type { AuthEventMap } from "./auth";
export type { EmbeddedWalletEventMap } from "./embeddedWallet";
export type { FlowEndExtras, FlowEventMap, FlowOutcome } from "./flow";
export { flowOutcomeToEventName } from "./flow";
export type {
    InAppBrowserRedirectTarget,
    ListenerMiscEventMap,
} from "./listener";
export type { ModalDismissSource, ModalEventMap } from "./modal";
export type { SharingEventMap } from "./sharing";
export type { ListenerTxEventMap } from "./transaction";

/**
 * Single merged event map used for typed tracking across the wallet +
 * listener apps. Add app-specific domains here as new phases land
 * (tokens_*, onboarding_*, recovery_*, …).
 */
export type EventMap = AuthEventMap &
    SharingEventMap &
    FlowEventMap &
    ModalEventMap &
    ListenerTxEventMap &
    EmbeddedWalletEventMap &
    ListenerMiscEventMap;
