import * as coreSdkIndex from "@frak-labs/core-sdk";
import {
    type FrakWalletSdkConfig,
    setupClient,
    trackEvent,
    withCache,
} from "@frak-labs/core-sdk";
import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { detectListenerPreloads } from "../utils/dom/detectListenerPreloads";
import { openSharingPage } from "../actions/sharingPage";
import { decodeProductsParam } from "../utils/sharingPageProducts";
import { openWalletModal } from "../components/ButtonWallet/utils";
import { dispatchClientReadyEvent } from "./clientReady";

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
        config: withDynamicPreload(window.FrakSetup.config),
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
 * Inject a dynamically-computed `preload` list when the caller hasn't set
 * one explicitly.
 *
 * Rationale: the listener iframe warms Ring 1/Ring 2 chunks based on the
 * `#preload=...` hash. The components CDN entry can detect which Frak
 * components are actually on the page and avoid the warm-up cost when none
 * are mounted. An explicit `config.preload` (including `[]`) is respected
 * as an escape hatch.
 */
function withDynamicPreload(config: FrakWalletSdkConfig): FrakWalletSdkConfig {
    if (config.preload !== undefined) return config;
    return { ...config, preload: detectListenerPreloads() };
}

/**
 * Check the query param contain params for an auto opening of the frak modal
 */
function handleActionQueryParam() {
    const url = new URL(window.location.href);
    if (url.searchParams.get("frakAction") !== "share") {
        return;
    }

    console.log("[Frak SDK] Auto open share via query param");

    const link = url.searchParams.get("link") ?? undefined;
    const placement = url.searchParams.get("placement") ?? undefined;
    const products = decodeProductsParam(url.searchParams.get("products"));

    // Clean URL immediately so a refresh / share of the current URL does
    // not re-trigger the auto-open. Same idiom as `fmt` / `sso` cleanup.
    url.searchParams.delete("frakAction");
    url.searchParams.delete("link");
    url.searchParams.delete("placement");
    url.searchParams.delete("products");
    window.history.replaceState({}, "", url.toString());

    openSharingPage(undefined, placement, { link, products });
}
