/**
 * Ring 0 — pure-TS iframe bootstrap.
 *
 * Runs synchronously on iframe load:
 *  - Creates the RPC listener and registers every handler (lifecycle,
 *    SSO, vanilla factories from `module/hooks/*`, display* factories).
 *  - Emits `iframeLifecycle: "connected"` so the SDK knows the iframe is
 *    alive (no longer waits for i18next — i18n overrides are queued and
 *    drained when Ring 1 mounts; see `i18nOverrideQueue` in step 6).
 *  - Sends the boot ping to the metrics server.
 *  - Honors the `?preload=...` URL hash to warm the Ring 1 + Ring 2
 *    chunks before the first user click.
 *
 * Keep this module React-free so the eager bundle stays small. UI work
 * is triggered via `uiBus.request` (which auto-mounts Ring 1 lazily).
 */

import type { FrakLifecycleEvent } from "@frak-labs/core-sdk";
import { createRpcListener } from "@frak-labs/frame-connector";
import {
    clientLifecycleHandler,
    emitConnected,
} from "@/module/handlers/lifecycleHandler";
import {
    handleOpenSso,
    handlePrepareSso,
    handleSsoComplete,
} from "@/module/handlers/ssoHandler";
import { createDisplayEmbeddedWalletHandler } from "@/module/hooks/useDisplayEmbeddedWallet";
import { createDisplayModalHandler } from "@/module/hooks/useDisplayModalListener";
import { createDisplaySharingPageHandler } from "@/module/hooks/useDisplaySharingPageListener";
import { createGetMerchantInformationHandler } from "@/module/hooks/useOnGetMerchantInformation";
import { createGetMergeTokenHandler } from "@/module/hooks/useOnGetMergeToken";
import { createGetUserReferralStatusHandler } from "@/module/hooks/useOnGetUserReferralStatus";
import { createSendInteractionHandler } from "@/module/hooks/useSendInteractionListener";
import { createWalletStatusHandler } from "@/module/hooks/useWalletStatusListener";
import {
    loggingMiddleware,
    walletContextMiddleware,
} from "@/module/middleware";
import type {
    CombinedRpcSchema,
    WalletRpcContext,
} from "@/module/types/context";
import { ensureHydrated } from "@/queryClient";


/**
 * Send a one-shot ping to the metrics server so we can count iframe loads.
 * Fire-and-forget — failures are silently dropped, the metrics endpoint
 * is best-effort.
 */
function sendBootPing(): void {
    void fetch("https://metrics.frak.id/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ua: navigator.userAgent }),
    });
}

/**
 * Reads `?preload=modal,sharing,wallet` from the iframe URL hash and
 * idle-warms the matching Ring 1 + Ring 2 chunks plus the lazy impl
 * modules. Used by partner sites that know they will trigger UI within
 * a few hundred ms — eliminates the cold-start dynamic import latency.
 */
function setupPreloadHints(): void {
    if (typeof window === "undefined") return;

    const hash = window.location.hash.slice(1);
    const urlParams = new URLSearchParams(hash);
    const preloadRaw = urlParams.get("preload");
    if (!preloadRaw) return;

    const preloads = preloadRaw.split(",");
    const wantsModal = preloads.includes("modal");
    const wantsSharing = preloads.includes("sharing");
    const wantsWallet = preloads.includes("wallet");

    if (!wantsModal && !wantsSharing && !wantsWallet) return;

    const handler = async () => {
        // Always warm Ring 1 (preact + provider tree) when any UI is hinted.
        const promises: Promise<unknown>[] = [import("@/ui/runtime")];

        if (wantsModal) {
            promises.push(
                import("@/module/modal/component/Modal"),
                import("@/module/hooks/useDisplayModalListener.impl")
            );
        }
        if (wantsSharing) {
            promises.push(
                import("@/module/sharing/component/SharingPage"),
                import("@/module/hooks/useDisplaySharingPageListener.impl")
            );
        }
        if (wantsWallet) {
            promises.push(
                import("@/module/embedded/component/Wallet"),
                import("@/module/hooks/useDisplayEmbeddedWallet.impl")
            );
        }

        await Promise.all(promises);
    };

    if ("requestIdleCallback" in window) {
        const id = (
            window as Window & {
                requestIdleCallback: (cb: () => void) => number;
            }
        ).requestIdleCallback(handler);
        // No teardown — bootstrap runs once per iframe lifetime.
        void id;
        return;
    }
    setTimeout(handler, 0);
}

/**
 * Mark the document root with `data-listener="true"` so listener-only
 * styles (e.g. transparent background) apply. This used to live in a
 * React effect; running it eagerly in Ring 0 means it applies before
 * the first paint — slightly snappier and one less Ring 1 dependency.
 */
function markRootListener(): void {
    if (typeof document === "undefined") return;
    const rootElement = document.querySelector(":root") as HTMLElement | null;
    if (rootElement) {
        rootElement.dataset.listener = "true";
    }
}

/**
 * Wire the RPC listener to its handler stack and signal readiness to the
 * SDK. Returns the listener instance so callers (typically tests) can
 * tear it down explicitly.
 */
export function bootstrap(): { cleanup: () => void } {
    if (typeof window === "undefined") {
        return { cleanup: () => {} };
    }

    markRootListener();

    // Kick off lazy sessionStorage hydration so the singleton QueryClient
    // can serve cached entries to handlers that arrive before Ring 1 mounts.
    void ensureHydrated();

    // Vanilla factory handlers — created once, no React deps.
    const onWalletListenRequest = createWalletStatusHandler();
    const onGetMerchantInformation = createGetMerchantInformationHandler();
    const onSendInteraction = createSendInteractionHandler();
    const onGetUserReferralStatus = createGetUserReferralStatusHandler();
    const onGetMergeToken = createGetMergeTokenHandler();
    const onDisplayModalRequest = createDisplayModalHandler();
    const onDisplayEmbeddedWallet = createDisplayEmbeddedWalletHandler();
    const onDisplaySharingPage = createDisplaySharingPageHandler();

    // Create the listener with combined schema (IFrame + SSO).
    // We accept all origins with "*" because the actual security validation
    // happens in walletContextMiddleware (matching merchantId from origin
    // against stored iframeResolvingContext).
    //
    // Middleware stack order (RPC messages only):
    //  1. loggingMiddleware - Logs requests/responses (development only)
    //  2. walletContextMiddleware - Augments context with merchantId, sourceUrl, etc.
    const listener = createRpcListener<
        CombinedRpcSchema,
        WalletRpcContext,
        FrakLifecycleEvent
    >({
        transport: window,
        allowedOrigins: "*",
        middleware: [loggingMiddleware, walletContextMiddleware],
        lifecycleHandlers: {
            clientLifecycle: clientLifecycleHandler,
        },
    });

    // Register promise-based handlers (IFrameRpcSchema)
    listener.handle("frak_displayModal", onDisplayModalRequest);
    listener.handle("frak_prepareSso", handlePrepareSso);
    listener.handle("frak_openSso", handleOpenSso);
    listener.handle("frak_getMerchantInformation", onGetMerchantInformation);
    listener.handle("frak_displayEmbeddedWallet", onDisplayEmbeddedWallet);
    listener.handle("frak_sendInteraction", onSendInteraction);
    listener.handle("frak_getUserReferralStatus", onGetUserReferralStatus);
    listener.handle("frak_displaySharingPage", onDisplaySharingPage);
    listener.handle("frak_getMergeToken", onGetMergeToken);

    // Register streaming handlers (IFrameRpcSchema)
    listener.handleStream("frak_listenToWalletStatus", onWalletListenRequest);

    // Register SSO handlers (SsoRpcSchema)
    listener.handle("sso_complete", handleSsoComplete);

    // All handlers are wired up — signal readiness to the SDK immediately.
    // Step 6 introduces the i18n override queue so we no longer wait for
    // i18next to be initialised; lifecycle messages that need translations
    // are buffered until Ring 1 drains the queue.
    emitConnected();

    sendBootPing();
    setupPreloadHints();

    // The iframe lives for the lifetime of the parent page, but expose a
    // cleanup hook for tests + HMR.
    return {
        cleanup: () => listener.cleanup(),
    };
}
