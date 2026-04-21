import type { Session } from "../../types/Session";
import { getInitProperties, getPlatformInfo, openPanel } from "./openpanel";
import type { AnalyticsGlobalProperties } from "./types";

const SESSION_ID_STORAGE_KEY = "frak_analytics_session_id";

/**
 * Profile properties buffered before the user is identified. Flushed into
 * the `openPanel.identify` call when `identifyAuthenticatedUser` runs so
 * attributes like `install_source` (set pre-auth) still make it onto the
 * profile after login.
 */
const pendingProfileProps: Record<string, unknown> = {};

export function setProfileId(profileId?: string) {
    if (!openPanel) return;
    openPanel.profileId = profileId;
}

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

function getAppVersion(): string | undefined {
    return process.env.APP_VERSION;
}

/**
 * Initialise OpenPanel and merge the baseline global properties
 * (platform + iframe flags + session / build).
 */
export function initAnalytics() {
    if (!openPanel) return;
    openPanel.init();
    updateGlobalProperties({
        ...getInitProperties(),
        session_id: getOrCreateSessionId(),
        app_version: getAppVersion(),
    });
}

/**
 * Attach the install attribution source to the user's profile. Called
 * pre-auth from `useInstallReferrer` / `useResolveInstallCode`; the value
 * is buffered until the user identifies on login/register.
 */
export function setInstallSource(source: string) {
    setProfileProperty("install_source", source);
}

/**
 * Flag the current OpenPanel session as belonging to an authenticated user.
 * Updates wallet/session_id global props, identifies the profile with
 * platform metadata + any buffered profile props, and emits `user_logged_in`.
 *
 * Does NOT emit the domain `${event}_completed` event — callers emit that
 * via `trackEvent("register_completed", { flow_id })` so the flow_id is
 * attached explicitly.
 */
export function identifyAuthenticatedUser(session: Omit<Session, "token">) {
    if (!openPanel) return;
    updateGlobalProperties({
        wallet: session.address,
        session_id: getOrCreateSessionId(),
    });
    openPanel.identify({
        profileId: session.address,
        properties: {
            sessionType: session.type ?? "webauthn",
            sessionSrc: "pairing",
            ...getPlatformInfo(),
            ...pendingProfileProps,
        },
    });
    // Clear buffered props now that they're on the profile
    for (const key of Object.keys(pendingProfileProps)) {
        delete pendingProfileProps[key];
    }
    openPanel.track("user_logged_in");
}
