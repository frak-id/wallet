import type { Session } from "../../types/Session";
import { rememberHostAnonymousId } from "./anonymousId";
import { crashlytics } from "./crashlytics";
import { setProfileProperties, startIdentity, syncWallet } from "./identity";
import {
    getInitProperties,
    getPlatformInfo,
    openPanel,
    setAnalyticsSurface,
} from "./openpanel";
import type { AnalyticsGlobalProperties, AnalyticsSurface } from "./types";

const SESSION_ID_STORAGE_KEY = "frak_analytics_session_id";

export function updateGlobalProperties(
    properties: Partial<AnalyticsGlobalProperties>
) {
    openPanel?.setGlobalProperties(properties);
}

/**
 * Return (and lazily create) a per-tab analytics session id.
 * Persisted in `sessionStorage` so it survives in-tab navigations but resets
 * on new tabs / tab close, giving us a useful "session depth" KPI.
 */
export function getOrCreateSessionId(): string {
    if (typeof window === "undefined") return "";
    try {
        const stored = sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
        if (stored) return stored;
        const id = crypto.randomUUID();
        sessionStorage.setItem(SESSION_ID_STORAGE_KEY, id);
        return id;
    } catch {
        return crypto.randomUUID();
    }
}

/**
 * Initialise OpenPanel and merge the baseline global properties
 * (surface + platform + iframe flags + session / build).
 * `hostAnonymousId` is the id of the host that opened this surface, if any.
 */
export function initAnalytics(
    surface: AnalyticsSurface,
    { hostAnonymousId }: { hostAnonymousId?: string | null } = {}
) {
    // Crashlytics keys mirror the most useful OpenPanel globals so crash
    // reports can be filtered by platform / version / runtime context
    // without round-tripping the OpenPanel dashboard. Run regardless of
    // openPanel availability — listener may ship without an OpenPanel
    // client id but we still want crash context.
    setAnalyticsSurface(surface);
    rememberHostAnonymousId(hostAnonymousId);
    const initProps = getInitProperties();
    const platformInfo = getPlatformInfo();
    void crashlytics?.setKey("platform", platformInfo.platform);
    void crashlytics?.setKey("surface", surface);
    if (process.env.APP_VERSION && crashlytics)
        void crashlytics.setKey("app_version", process.env.APP_VERSION);

    openPanel?.init();
    updateGlobalProperties({
        ...initProps,
        surface,
        session_id: getOrCreateSessionId(),
        app_version: process.env.APP_VERSION,
    });
    startIdentity(surface);
}

/**
 * Attach the install attribution source to the user's profile. Called
 * pre-auth from `useInstallReferrer` / `useResolveInstallCode`; the value
 * lands on the anonymous profile, so it is there before login.
 */
export function setInstallSource(source: string) {
    // Surface install attribution as a crash-report key so we can split
    // crash rates per acquisition channel.
    void crashlytics?.setKey("install_source", source);
    setProfileProperties({ install_source: source });
}

/**
 * Attach the authenticated wallet to the stable anonymous profile and emit
 * `user_logged_in`. The wallet is a property, never the profile id.
 *
 * Does NOT emit the domain `${event}_completed` event — callers emit that
 * via `trackEvent("register_completed", { flow_id })` so the flow_id is
 * attached explicitly.
 */
export function identifyAuthenticatedUser(session: Omit<Session, "token">) {
    // No-op when `sessionStore` already carries this wallet, which is the usual case.
    syncWallet(session);
    updateGlobalProperties({ session_id: getOrCreateSessionId() });
    openPanel?.track("user_logged_in");
}
