import * as coreSdkIndex from "@frak-labs/core-sdk";
import { setupClient, trackEvent, withCache } from "@frak-labs/core-sdk";
import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { dispatchClientReadyEvent } from "./clientReady";
import { FRAK_ACTION_KEY, FRAK_DATA_KEY, parseShareLinkPayload } from "./shareLink";
import { openSharingPage } from "./sharingPage";

/**
 * Initializes the Frak SDK client and sets up necessary configurations.
 * Uses withCache for inflight dedup — concurrent callers share the same promise.
 * Failures are not cached, allowing retry on next call.
 *
 * @returns {Promise<void>}
 */
export function initFrakSdk(): Promise<void> {
    // Expose core SDK immediately (idempotent)
    window.FrakSetup.core = { ...coreSdkIndex, ...coreSdkActions };

    // Already initialized
    if (window.FrakSetup?.client) {
        return Promise.resolve();
    }

    // withCache deduplicates concurrent calls and caches success with Infinity TTL.
    // doInit throws on failure → withCache won't cache rejections → retry is possible.
    // .catch prevents unhandled rejections (callers don't await the return value).
    return withCache(() => doInit(), {
        cacheKey: "frak-sdk-init",
        cacheTime: Number.POSITIVE_INFINITY,
    }).catch((err: unknown) => {
        // No client yet means the per-client OpenPanel instance isn't
        // available. Fall back to `window.FrakSetup?.client` — it may have
        // been populated by a prior doInit() run even if this one failed.
        trackEvent(window.FrakSetup?.client, "sdk_init_failed", {
            reason:
                err instanceof Error
                    ? err.message
                    : typeof err === "string"
                      ? err
                      : "unknown",
            config_missing: !window.FrakSetup?.config,
        });
    });
}

/**
 * Performs the actual SDK initialization.
 * Throws on failure so withCache doesn't cache failed attempts.
 */
async function doInit(): Promise<void> {
    if (!window.FrakSetup?.config) {
        throw new Error(
            "[Frak SDK] Configuration not found. Please ensure window.FrakSetup.config is set."
        );
    }

    console.log("[Frak SDK] Starting initialization");

    const client = await setupClient({
        config: window.FrakSetup.config,
    });

    if (!client) {
        throw new Error("[Frak SDK] Failed to create client");
    }

    // Set up global client instance
    window.FrakSetup.client = client;

    console.log("[Frak SDK] Client initialized successfully");

    // Dispatch the event to let the rest of the app know that the Frak client is ready
    dispatchClientReadyEvent();

    // Setup the referral
    coreSdkActions.setupReferral(client);

    // Handle the action query param
    handleActionQueryParam();
}

/**
 * Check the query param contain params for an auto opening of a frak action
 *
 * Strips the matched params from the URL via `history.replaceState` so the
 * action does not re-fire on refresh or back navigation.
 */
function handleActionQueryParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const frakAction = urlParams.get(FRAK_ACTION_KEY);
    if (!frakAction) {
        return;
    }

    if (frakAction === "share") {
        console.log("[Frak SDK] Auto share trigger detected");
        const payload = parseShareLinkPayload();
        openSharingPage(
            payload?.targetInteraction,
            undefined,
            payload
                ? { link: payload.link, products: payload.products }
                : undefined
        );
        stripFrakActionParams();
    }
}

/**
 * Remove frak auto-action params from the current URL.
 *
 * No-op outside a browser (or when no params are present).
 */
function stripFrakActionParams() {
    if (typeof window === "undefined" || !window.history?.replaceState) {
        return;
    }
    const url = new URL(window.location.href);
    if (
        !url.searchParams.has(FRAK_ACTION_KEY) &&
        !url.searchParams.has(FRAK_DATA_KEY)
    ) {
        return;
    }
    url.searchParams.delete(FRAK_ACTION_KEY);
    url.searchParams.delete(FRAK_DATA_KEY);
    window.history.replaceState(null, "", url.toString());
}
