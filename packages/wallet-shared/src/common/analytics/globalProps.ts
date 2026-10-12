import type { Session } from "../../types/Session";
import { rememberHostAnonymousId } from "./anonymousId";
import { crashlytics } from "./crashlytics";
import { applyIdentity, setWallet } from "./identity";
import {
    getInitProperties,
    getPlatformInfo,
    openPanel,
    setAnalyticsSurface,
} from "./openpanel";
import type { AnalyticsGlobalProperties, AnalyticsSurface } from "./types";

const SESSION_ID_STORAGE_KEY = "frak_analytics_session_id";

/**
 * Profile properties buffered before the user is identified. Flushed into
 * the `openPanel.identify` call when `identifyAuthenticatedUser` runs so
 * attributes like `install_source` (set pre-auth) still make it onto the
 * profile after login.
 */
const pendingProfileProps: Record<string, unknown> = {};

export function updateGlobalProperties(
    properties: Partial<AnalyticsGlobalProperties>
) {
    if (!openPanel) return;
    const current = openPanel.global ?? {};
    openPanel.setGlobalProperties({
        ...current,
        ...properties,
    });
}

/**
 * Set a profile-level property. If the user is already identified it's
 * pushed to OpenPanel immediately; otherwise buffered and flushed on the
 * next `identifyAuthenticatedUser` call.
 */
function setProfileProperty(key: string, value: unknown) {
    pendingProfileProps[key] = value;
    if (openPanel?.profileId) {
        openPanel.identify({
            profileId: openPanel.profileId,
            properties: { [key]: value },
        });
    }
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
 */
export function initAnalytics(surface: AnalyticsSurface) {
    // Crashlytics keys mirror the most useful OpenPanel globals so crash
    // reports can be filtered by platform / version / runtime context
    // without round-tripping the OpenPanel dashboard. Run regardless of
    // openPanel availability — listener may ship without an OpenPanel
    // client id but we still want crash context.
    setAnalyticsSurface(surface);
    const initProps = getInitProperties();
    const platformInfo = getPlatformInfo();
    void crashlytics?.setKey("platform", platformInfo.platform);
    void crashlytics?.setKey("surface", surface);
    if (process.env.APP_VERSION && crashlytics)
        void crashlytics.setKey("app_version", process.env.APP_VERSION);

    if (!openPanel) return;
    openPanel.init();
    updateGlobalProperties({
        ...initProps,
        surface,
        session_id: getOrCreateSessionId(),
        app_version: process.env.APP_VERSION,
    });
    // The listener iframe is handed its id by the SDK through the URL.
    if (surface === "listener") {
        rememberHostAnonymousId(
            new URLSearchParams(window.location.search).get("clientId")
        );
    }
    // Before the first event: a later change of the device id re-keys the session.
    applyIdentity();
}

/**
 * Attach the install attribution source to the user's profile. Called
 * pre-auth from `useInstallReferrer` / `useResolveInstallCode`; the value
 * is buffered until the user identifies on login/register.
 */
export function setInstallSource(source: string) {
    // Surface install attribution as a crash-report key so we can split
    // crash rates per acquisition channel.
    void crashlytics?.setKey("install_source", source);
    setProfileProperty("install_source", source);
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
    void crashlytics?.setKey("session_type", session.type ?? "webauthn");
    void crashlytics?.setKey("session_src", "pairing");

    updateGlobalProperties({ session_id: getOrCreateSessionId() });
    setWallet(session.address, {
        session_type: session.type ?? "webauthn",
        session_src: "pairing",
        ...getPlatformInfo(),
        ...pendingProfileProps,
    });

    if (!openPanel) return;
    // Clear buffered props now that they're on the profile
    for (const key of Object.keys(pendingProfileProps)) {
        delete pendingProfileProps[key];
    }
    openPanel.track("user_logged_in");
}
