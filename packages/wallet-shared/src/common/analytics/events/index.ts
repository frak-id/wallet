import type { AuthEventMap } from "./auth";
import type { EmbeddedWalletEventMap } from "./embeddedWallet";
import type { InstallEventMap } from "./install";
import type { ListenerMiscEventMap } from "./listener";
import type { ModalEventMap, WalletModalEventMap } from "./modal";
import type { NotificationEventMap } from "./notification";
import type { OnboardingEventMap } from "./onboarding";
import type { PairingEventMap } from "./pairing";
import type { SharingEventMap } from "./sharing";
import type { TokensEventMap } from "./tokens";
import type { ListenerTxEventMap } from "./transaction";

export type { AuthEventMap } from "./auth";
export type { EmbeddedWalletEventMap } from "./embeddedWallet";
export type {
    FlowEndExtras,
    FlowEvents,
    FlowOutcome,
    FlowStartExtras,
} from "./flow";
export type {
    InstallEventMap,
    InstallPageView,
    InstallReferrerMissingReason,
    InstallSource,
    InstallStore,
} from "./install";
export type {
    InAppBrowserRedirectTarget,
    ListenerMiscEventMap,
} from "./listener";
export type {
    ModalDismissSource,
    ModalEventMap,
    WalletModalEventMap,
} from "./modal";
export type {
    NotificationEventMap,
    NotificationOptInOutcome,
} from "./notification";
export type { OnboardingAction, OnboardingEventMap } from "./onboarding";
export type {
    PairingErrorState,
    PairingEventMap,
    PairingMode,
} from "./pairing";
export type { SharingEventMap } from "./sharing";
export type { TokensEventMap, TokensSendAmountBucket } from "./tokens";
export type { ListenerTxEventMap } from "./transaction";

export type EventMap = AuthEventMap &
    SharingEventMap &
    ModalEventMap &
    WalletModalEventMap &
    ListenerTxEventMap &
    EmbeddedWalletEventMap &
    ListenerMiscEventMap &
    OnboardingEventMap &
    NotificationEventMap &
    PairingEventMap &
    TokensEventMap &
    InstallEventMap;
