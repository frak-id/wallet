import * as coreSdkIndex from "@frak-labs/core-sdk";
import {
    decodeProductsParam,
    deleteQueryParamCaseInsensitive,
    type FrakWalletSdkConfig,
    getQueryParamCaseInsensitive,
    setupClient,
    trackEvent,
    withCache,
} from "@frak-labs/core-sdk";
import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { openSharingPage } from "../actions/sharingPage";
import { detectListenerPreloads } from "../utils/dom/detectListenerPreloads";
import { dispatchClientReadyEvent } from "./clientReady";

/**
 * Initializes the Frak SDK client and sets up necessary configurations.
 * Uses withCache for inflight dedup — concurrent callers share the same promise.
 * Failures are not cached, allowing retry on next call.
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

    const client = await setupClient({
        config: withDynamicPreload(window.FrakSetup.config),
    });

    if (!client) {
        throw new Error("[Frak SDK] Failed to create client");
    }

    window.FrakSetup.client = client;

    dispatchClientReadyEvent();
    coreSdkActions.setupReferral(client);
    handleActionQueryParam();
}

/**
 * Inject a dynamically-computed `preload` list, so the listener only warms the
 * chunks the mounted components need. An explicit `config.preload` (including
 * `[]`) is respected as an escape hatch.
 */
function withDynamicPreload(config: FrakWalletSdkConfig): FrakWalletSdkConfig {
    if (config.preload !== undefined) return config;
    return { ...config, preload: detectListenerPreloads() };
}

/**
 * Auto-open the sharing page from `?frakAction=share`, optionally scoped by
 * `link`, `placement` and a `compressJsonToB64` `products` payload. Keys and
 * the keyword value are matched case-insensitively: email tools and browsers
 * lowercase the whole URL in transit (`?FrakAction=Share`).
 */
function handleActionQueryParam() {
    const url = new URL(window.location.href);
    const action = getQueryParamCaseInsensitive(url.searchParams, "frakAction");
    if (action?.toLowerCase() !== "share") {
        return;
    }

    const link =
        getQueryParamCaseInsensitive(url.searchParams, "link") ?? undefined;
    const placement =
        getQueryParamCaseInsensitive(url.searchParams, "placement") ??
        undefined;
    const products = decodeProductsParam(
        getQueryParamCaseInsensitive(url.searchParams, "products")
    );

    // Clean URL immediately so a refresh / share of the current URL does
    // not re-trigger the auto-open. Same idiom as `fmt` / `sso` cleanup.
    deleteQueryParamCaseInsensitive(url.searchParams, "frakAction");
    deleteQueryParamCaseInsensitive(url.searchParams, "link");
    deleteQueryParamCaseInsensitive(url.searchParams, "placement");
    deleteQueryParamCaseInsensitive(url.searchParams, "products");
    window.history.replaceState({}, "", url.toString());

    openSharingPage(undefined, placement, { link, products });
}
