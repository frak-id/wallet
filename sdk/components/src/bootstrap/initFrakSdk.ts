import * as coreSdkIndex from "@frak-labs/core-sdk";
import {
    createSdkOpenPanel,
    decodeProductsParam,
    deleteQueryParamCaseInsensitive,
    type FrakWalletSdkConfig,
    getClientIdAsync,
    getQueryParamCaseInsensitive,
    setupClient,
    trackEvent,
    withCache,
} from "@frak-labs/core-sdk";
import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { FrakRpcError } from "@frak-labs/frame-connector";
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
    // Reported inside the cached fn: every caller's .catch would fire per caller,
    // and on withCache's own backoff rejections.
    return withCache(
        () =>
            doInit().catch((err: unknown) => {
                void reportInitFailure(err);
                throw err;
            }),
        {
            cacheKey: "frak-sdk-init",
            cacheTime: Number.POSITIVE_INFINITY,
        }
    ).catch(() => {});
}

type InitFailureReason = "config_missing" | "client_unavailable";

function initFailure(reason: InitFailureReason, message: string) {
    return Object.assign(new Error(message), { reason });
}

/** A code, not the message: OpenPanel drops a value starting with `[`. */
function failureReason(err: unknown): string {
    if (!(err instanceof Error)) return "unknown";
    if ("reason" in err && typeof err.reason === "string") return err.reason;
    // FrakRpcError leaves `name` as "Error".
    if (err instanceof FrakRpcError) return `rpc_${err.code}`;
    return err.name;
}

/** No client exists after a failed init, so the event goes through its own OpenPanel. */
async function reportInitFailure(err: unknown) {
    const clientId = await getClientIdAsync().catch(() => undefined);
    trackEvent({ openPanel: createSdkOpenPanel(clientId) }, "sdk_init_failed", {
        reason: failureReason(err),
        config_missing: !window.FrakSetup?.config,
        domain: window.FrakSetup?.config?.domain ?? window.location.hostname,
    });
}

/**
 * Performs the actual SDK initialization.
 * Throws on failure so withCache doesn't cache failed attempts.
 */
async function doInit(): Promise<void> {
    if (!window.FrakSetup?.config) {
        throw initFailure(
            "config_missing",
            "[Frak SDK] Configuration not found. Please ensure window.FrakSetup.config is set."
        );
    }

    const client = await setupClient({
        config: withDynamicPreload(window.FrakSetup.config),
    });

    if (!client) {
        throw initFailure(
            "client_unavailable",
            "[Frak SDK] Failed to create client"
        );
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

    // Ahead of the open, so the funnel reads auto-open → `sharing_page_opened`
    // the same way a click reads `share_button_clicked` → `sharing_page_opened`.
    trackEvent(window.FrakSetup?.client, "sharing_page_auto_opened", {
        placement,
        has_link: Boolean(link),
        has_products: Boolean(products?.length),
    });

    openSharingPage("auto_open", undefined, placement, { link, products });
}
