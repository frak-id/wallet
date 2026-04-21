import type { Session } from "../../types/Session";
import {
    getOrCreateSessionId,
    initAnalytics,
    updateGlobalProperties,
} from "./globalProps";
import { getPlatformInfo, openPanel } from "./openpanel";
import type { AnalyticsAuthenticationType } from "./types";

export type {
    AuthEventMap,
    EmbeddedWalletEventMap,
    EventMap,
    FlowEndExtras,
    FlowEventMap,
    FlowOutcome,
    InAppBrowserRedirectTarget,
    ListenerMiscEventMap,
    ListenerTxEventMap,
    ModalDismissSource,
    ModalEventMap,
    SharingEventMap,
} from "./events";
export { flowOutcomeToEventName } from "./events";
export {
    getOrCreateSessionId,
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

// ---------------------------------------------------------------------------
// Backward-compatible helpers. Keep their signatures identical so existing
// callsites in wallet-shared/apps/listener keep working during the Phase 2+
// rollout that migrates them to `trackEvent(...)`.
// ---------------------------------------------------------------------------

export async function trackAuthInitiated(
    event: AnalyticsAuthenticationType,
    args?: {
        method?: "global" | "specific" | "popup" | "link" | "mobile";
    }
) {
    if (!openPanel) return;
    await openPanel.track(`${event}_initiated`, args);
}

export async function trackAuthCompleted(
    event: AnalyticsAuthenticationType,
    wallet: Omit<Session, "token">
) {
    if (!openPanel) return;
    updateGlobalProperties({
        wallet: wallet.address,
        session_id: getOrCreateSessionId(),
    });
    await Promise.allSettled([
        await openPanel.identify({
            profileId: wallet.address,
            properties: {
                sessionType: wallet.type ?? "webauthn",
                sessionSrc: "pairing",
                ...getPlatformInfo(),
            },
        }),
        openPanel.track(`${event}_completed`),
        openPanel.track("user_logged_in"),
    ]);
}

export async function trackAuthFailed(
    event: AnalyticsAuthenticationType,
    reason: string
) {
    if (!openPanel) return;
    openPanel.track(`${event}_failed`, {
        reason,
    });
}

export async function trackGenericEvent(
    event: string,
    params?: Record<string, unknown>
) {
    if (!openPanel) return;
    await openPanel.track(event, params);
}
