import { getInitProperties, openPanel } from "./openpanel";
import type { AnalyticsGlobalProperties } from "./types";

const SESSION_ID_STORAGE_KEY = "frak_analytics_session_id";

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
 * (platform + iframe flags + session / build / locale).
 */
export function initAnalytics(initialLocale?: string) {
    if (!openPanel) return;
    openPanel.init();
    updateGlobalProperties({
        ...getInitProperties(),
        session_id: getOrCreateSessionId(),
        app_version: getAppVersion(),
        locale: initialLocale,
    });
}

export function setLocale(locale: string) {
    updateGlobalProperties({ locale });
}

export function setBiometricsFlag(hasBiometrics: boolean) {
    updateGlobalProperties({ has_biometrics: hasBiometrics });
}

export function setInstallSource(source: string) {
    updateGlobalProperties({ install_source: source });
}
