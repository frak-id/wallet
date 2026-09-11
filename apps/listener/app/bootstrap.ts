/**
 * Ring 0 — pure-TS iframe bootstrap, runs synchronously on iframe load.
 *
 * Keep this module React-free so the eager bundle stays small. UI work
 * is triggered via `uiBus.request` (which auto-mounts Ring 1 lazily).
 */

import type { FrakLifecycleEvent } from "@frak-labs/core-sdk";
import { createRpcListener } from "@frak-labs/frame-connector";
import { warmI18nLocale } from "@/i18nPreload";
import {
    clientLifecycleHandler,
    emitConnected,
} from "@/module/handlers/lifecycleHandler";
import {
    handleOpenSso,
    handlePrepareSso,
    handleSsoComplete,
} from "@/module/handlers/ssoHandler";
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
 * Run a callback during browser idle time, falling back to a macrotask where
 * requestIdleCallback is unavailable (Safari < 17). Keeps fire-and-forget work
 * off the iframe boot critical path.
 */
function runWhenIdle(callback: () => void): void {
    if (typeof window === "undefined") return;
    if ("requestIdleCallback" in window) {
        (
            window as Window & {
                requestIdleCallback: (cb: () => void) => number;
            }
        ).requestIdleCallback(callback);
        return;
    }
    setTimeout(callback, 0);
}

/**
 * Reads `?preload=modal,sharing` from the iframe URL hash and idle-warms the
 * matching Ring 1 + Ring 2 chunks. Each display chunk bundles its own
 * `useDisplay*.impl` handler body, so one `import()` warms both.
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

    if (!wantsModal && !wantsSharing) return;

    // Translations gate the first paint of any UI: fetch them without waiting
    // for idle time, so the JSON is in memory by the time Ring 1 mounts.
    warmI18nLocale();

    const handler = async () => {
        // Always warm Ring 1 (preact + provider tree) when any UI is hinted.
        const promises: Promise<unknown>[] = [import("@/ui/runtime")];

        if (wantsModal) {
            promises.push(import("@/module/modal/component/Modal"));
        }
        if (wantsSharing) {
            promises.push(import("@/module/sharing/component/SharingPage"));
        }

        await Promise.all(promises);
    };

    // No teardown — bootstrap runs once per iframe lifetime.
    runWhenIdle(handler);
}

/**
 * Mark the document root with `data-listener="true"` so listener-only styles
 * (e.g. transparent background) apply before the first paint.
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
    const onDisplaySharingPage = createDisplaySharingPageHandler();

    // `allowedOrigins: "*"` is safe only because walletContextMiddleware does
    // the real check (merchantId from origin vs stored iframeResolvingContext).
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
    listener.handle("frak_sendInteraction", onSendInteraction);
    listener.handle("frak_getUserReferralStatus", onGetUserReferralStatus);
    listener.handle("frak_displaySharingPage", onDisplaySharingPage);
    listener.handle("frak_getMergeToken", onGetMergeToken);

    // Register streaming handlers (IFrameRpcSchema)
    listener.handleStream("frak_listenToWalletStatus", onWalletListenRequest);

    // Register SSO handlers (SsoRpcSchema)
    listener.handle("sso_complete", handleSsoComplete);

    // Signal readiness without waiting for i18next: lifecycle messages that
    // need translations are buffered by the i18n override queue until Ring 1
    // drains it.
    emitConnected();

    setupPreloadHints();

    // The iframe lives for the lifetime of the parent page, but expose a
    // cleanup hook for tests + HMR.
    return {
        cleanup: () => listener.cleanup(),
    };
}
