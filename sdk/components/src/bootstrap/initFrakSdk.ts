import * as coreSdkIndex from "@frak-labs/core-sdk";
import {
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
import { decodeProductsParam } from "../utils/sharingPageProducts";
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
 * Check the query param for an auto-opening of the Frak sharing page.
 *
 * Supported params (all optional except `frakAction`):
 * - `frakAction=share` triggers the auto-open.
 * - `link` overrides the URL the sharing page generates outbound shares for.
 *   When omitted, the listener falls back to the merchant domain.
 * - `products` is a base64-encoded compressed JSON payload of
 *   `SharingPageProduct[]` — produced by `compressJsonToB64(productsArray)`
 *   on the sender side (e.g. a Klaviyo email template). Used by
 *   post-purchase emails to surface the items the customer just bought as
 *   product cards on the sharing page.
 * - `placement` lets the caller scope backend-driven CSS / config to a
 *   specific placement (mirrors the prop on the components).
 *
 * The four params are stripped from the URL via `history.replaceState` as
 * soon as they are read, so refreshes / shares of the current URL do not
 * re-trigger the auto-open. Matches the `fmt` (merge token) and `sso`
 * cleanup patterns elsewhere in the SDK.
 *
 * Param keys and the `frakAction` keyword value are matched case-insensitively
 * because some email tools and browsers lowercase the whole URL in transit
 * (e.g. `?FrakAction=Share` → `?frakaction=share`).
 */
function handleActionQueryParam() {
    const url = new URL(window.location.href);
    const action = getQueryParamCaseInsensitive(url.searchParams, "frakAction");
    if (action?.toLowerCase() !== "share") {
        return;
    }

    console.log("[Frak SDK] Auto open share via query param");

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
