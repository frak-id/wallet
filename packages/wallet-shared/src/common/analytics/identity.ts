import type { Address } from "viem";
import { clientIdStore } from "../../stores/clientIdStore";
import { rememberHostAnonymousId, resolveAnonymousId } from "./anonymousId";
import { crashlytics } from "./crashlytics";
import { openPanel } from "./openpanel";

let currentWallet: Address | undefined;
let watchingClientId = false;

function identifyWallet(properties?: Record<string, unknown>) {
    if (!openPanel?.profileId || !currentWallet) return;
    openPanel.identify({ profileId: String(openPanel.profileId), properties });
}

/**
 * Pin OpenPanel's profile and device to the stable anonymous id. The profile
 * is never the wallet address: that lives in the `wallet` property only.
 */
export function applyIdentity() {
    if (!openPanel) return;
    if (!watchingClientId) {
        // A late id (SSO `cId`, install referrer, rehydration) re-keys the identity.
        watchingClientId = true;
        clientIdStore.subscribe((state, previous) => {
            if (state.clientId !== previous.clientId) applyIdentity();
        });
    }
    const anonymousId = resolveAnonymousId();
    openPanel.profileId = anonymousId;
    openPanel.setGlobalProperties({ __deviceId: anonymousId });
    identifyWallet();
}

/** Adopt the id of the host that opened this surface, then re-key. */
export function setHostAnonymousId(id?: string | null) {
    if (!id) return;
    rememberHostAnonymousId(id);
    applyIdentity();
}

/**
 * Set or remove the `wallet` global property. When set, the anonymous profile
 * is identified with it; `profileProperties` ride on the same call.
 */
export function setWallet(
    address?: Address,
    profileProperties?: Record<string, unknown>
) {
    void crashlytics?.setUserId(address ?? "");
    currentWallet = address;
    openPanel?.setGlobalProperties({ wallet: address });
    identifyWallet(profileProperties);
}
