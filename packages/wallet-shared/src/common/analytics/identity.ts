import type { Address } from "viem";
import { clientIdStore } from "../../stores/clientIdStore";
import { sessionStore } from "../../stores/sessionStore";
import type { Session } from "../../types/Session";
import {
    getInstallId,
    rememberHostAnonymousId,
    resolveAnonymousId,
} from "./anonymousId";
import { crashlytics } from "./crashlytics";
import { getPlatformInfo, openPanel } from "./openpanel";
import type { AnalyticsSurface } from "./types";

let surface: AnalyticsSurface | undefined;
let currentWallet: Address | undefined;
let identifiedKey: string | undefined;
let started = false;
const pendingProfileProps: Record<string, unknown> = {};

/** The wallet app keeps one profile per install; hosted surfaces use the host's id. */
function resolveProfileId(): string {
    return surface === "wallet" ? getInstallId() : resolveAnonymousId();
}

/**
 * Push profile properties, buffered until a profile id exists. Without
 * properties, only a profile/wallet pair not identified yet is sent.
 */
function identify(properties: Record<string, unknown> = {}) {
    Object.assign(pendingProfileProps, properties);
    const profileId = openPanel?.profileId;
    if (!openPanel || !profileId) return;
    const key = currentWallet && `${profileId}:${currentWallet}`;
    const hasProperties = Object.keys(pendingProfileProps).length > 0;
    if (!hasProperties && (!key || key === identifiedKey)) return;

    identifiedKey = key ?? identifiedKey;
    const flushed = { ...pendingProfileProps };
    for (const name of Object.keys(pendingProfileProps)) {
        delete pendingProfileProps[name];
    }
    openPanel.identify({ profileId: String(profileId), properties: flushed });
}

function applyIdentity() {
    if (!openPanel) return;
    openPanel.profileId = resolveProfileId();
    openPanel.setGlobalProperties({ __deviceId: resolveAnonymousId() });
    identify();
}

/** Mirror the session wallet onto analytics. The wallet is never the profile id. */
export function syncWallet(
    session: Pick<Session, "address" | "type"> | null | undefined
) {
    const wallet = session?.address;
    if (wallet === currentWallet) return;
    currentWallet = wallet;
    void crashlytics?.setUserId(wallet ?? "");
    openPanel?.setGlobalProperties({ wallet });
    if (!session) return;

    const sessionType = session.type ?? "webauthn";
    void crashlytics?.setKey("session_type", sessionType);
    void crashlytics?.setKey("session_src", "pairing");
    identify({
        session_type: sessionType,
        session_src: "pairing",
        ...getPlatformInfo(),
    });
}

/** Must run before the first event: a later device id change re-keys the session. */
export function startIdentity(forSurface: AnalyticsSurface) {
    surface = forSurface;
    if (!started) {
        started = true;
        // A late id (SSO `cId`, install referrer, rehydration) re-keys the device.
        clientIdStore.subscribe((state, previous) => {
            if (state.clientId !== previous.clientId) applyIdentity();
        });
        sessionStore.subscribe((state) => syncWallet(state.session));
    }
    applyIdentity();
    syncWallet(sessionStore.getState().session);
}

/** Set a profile property now, or once the profile id is known. */
export function setProfileProperties(properties: Record<string, unknown>) {
    identify(properties);
}

/** Adopt the id of the host that opened this surface, then re-key. */
export function setHostAnonymousId(id?: string | null) {
    if (!id) return;
    rememberHostAnonymousId(id);
    applyIdentity();
}
