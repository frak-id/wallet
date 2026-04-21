import { initAnalytics } from "./globalProps";

export type {
    AuthEventMap,
    EmbeddedWalletEventMap,
    EventMap,
    FlowEndExtras,
    FlowEvents,
    FlowOutcome,
    FlowStartExtras,
    InAppBrowserRedirectTarget,
    InstallEventMap,
    InstallPageView,
    InstallReferrerMissingReason,
    InstallSource,
    InstallStore,
    ListenerMiscEventMap,
    ListenerTxEventMap,
    ModalDismissSource,
    ModalEventMap,
    NotificationEventMap,
    NotificationPermission,
    OnboardingAction,
    OnboardingEventMap,
    OnboardingStep,
    PairingErrorState,
    PairingEventMap,
    PairingMode,
    SharingEventMap,
    TokensEventMap,
    TokensSendAmountBucket,
    TokensSendValidationField,
} from "./events";
export {
    getOrCreateSessionId,
    identifyAuthenticatedUser,
    initAnalytics,
    setBiometricsFlag,
    setInstallSource,
    setLocale,
    setProfileId,
    updateGlobalProperties,
} from "./globalProps";
export { getPlatformInfo, openPanel } from "./openpanel";
export type { Flow } from "./startFlow";
export { startFlow } from "./startFlow";
export { trackEvent } from "./trackEvent";
export type {
    AnalyticsAuthenticationType,
    AnalyticsGlobalProperties,
} from "./types";

// Initialise OpenPanel at module load — preserves existing behaviour.
// Callers that need to update locale later should call `setLocale(...)`.
initAnalytics();

/**
 * Normalise an unknown thrown value into an analytics-friendly shape.
 * Used by the catch-block / onError tracking sites that emit `_failed`.
 */
export function extractAuthError(err: unknown): {
    reason: string;
    error_type: string | undefined;
} {
    const reason =
        err instanceof Error
            ? err.message || err.name
            : typeof err === "string"
              ? err
              : "unknown";
    const error_type = err instanceof Error ? err.name : undefined;
    return { reason, error_type };
}
