import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import {
    authenticatedBackendApi,
    getSafeSession,
} from "@frak-labs/wallet-shared";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import { pendingActionsStore } from "@/module/pending-actions/stores/pendingActionsStore";

type DeepLinkParams = {
    action: string;
    to?: string;
    amount?: string;
    id?: string;
    mode?: string;
    code?: string;
    state?: string;
    m?: string;
    a?: string;
};

function extractSearchParams(
    searchParams: URLSearchParams
): Omit<DeepLinkParams, "action"> {
    return {
        to: searchParams.get("to") ?? undefined,
        amount: searchParams.get("amount") ?? undefined,
        id: searchParams.get("id") ?? undefined,
        mode: searchParams.get("mode") ?? undefined,
        code: searchParams.get("code") ?? undefined,
        state: searchParams.get("state") ?? undefined,
        m: searchParams.get("m") ?? undefined,
        a: searchParams.get("a") ?? undefined,
    };
}

/**
 * Known wallet hosts that trigger App Link handling on Android.
 * When the OS opens the app via a verified HTTPS link, the URL arrives
 * here as an `https://` deep link instead of the `frakwallet://` scheme.
 */
const knownWalletHosts = new Set(["wallet.frak.id", "wallet-dev.frak.id"]);

function parseDeepLink(url: string): DeepLinkParams | null {
    try {
        const parsed = new URL(url);

        // frakwallet://pair?id=...&mode=embedded
        if (parsed.protocol === "frakwallet:") {
            const action =
                parsed.hostname || parsed.pathname.replace(/^\//, "") || "home";
            return { action, ...extractSearchParams(parsed.searchParams) };
        }

        // https://wallet.frak.id/pair?id=... (Android App Links)
        if (
            parsed.protocol === "https:" &&
            knownWalletHosts.has(parsed.hostname)
        ) {
            const action =
                parsed.pathname.replace(/^\//, "").split("/")[0] || "home";
            return { action, ...extractSearchParams(parsed.searchParams) };
        }

        return null;
    } catch (error) {
        console.error("[DeepLink] Failed to parse deep link:", url, error);
        return null;
    }
}

type NavigateFn = (options: {
    to: string;
    search?: Record<string, string>;
}) => unknown;

/**
 * Routes that don't require authentication (auth pages, recovery).
 */
const publicActions = new Set(["register", "login", "recovery"]);

function handleDeepLinkAction(navigate: NavigateFn, params: DeepLinkParams) {
    // Gate protected deep links behind auth
    if (!publicActions.has(params.action)) {
        const session = getSafeSession();
        if (!session?.token) {
            // Convert deep link to typed pending actions in the store
            storePendingActions(params);
            navigate({ to: "/register" });
            return;
        }
    }

    routeDeepLink(navigate, params);
}

/**
 * Convert deep link params to typed pending actions for post-auth execution.
 * Stores them in `pendingActionsStore` (persisted, survives refresh).
 */
function storePendingActions(params: DeepLinkParams) {
    const store = pendingActionsStore.getState();

    switch (params.action) {
        case "install":
            if (params.m && params.a) {
                store.addAction({
                    type: "ensure",
                    merchantId: params.m,
                    anonymousId: params.a,
                });
            }
            break;

        case "pair":
            if (params.id) {
                store.addAction({
                    type: "pairing",
                    pairingId: params.id,
                });
            }
            break;

        default: {
            // Convert generic deep link to a navigation action
            const target = deepLinkToRoute(params);
            if (target) {
                store.addAction({
                    type: "navigation",
                    to: target.to,
                    search: target.search,
                });
            }
            break;
        }
    }
}

/**
 * Map deep link params to a route path + search params.
 * Used to build navigation-type pending actions.
 */
function deepLinkToRoute(
    params: DeepLinkParams
): { to: string; search?: Record<string, string> } | null {
    switch (params.action) {
        case "send":
            return isCryptoMode
                ? {
                      to: "/tokens/send",
                      search: params.to ? { to: params.to } : undefined,
                  }
                : { to: "/wallet" };
        case "receive":
            return isCryptoMode ? { to: "/tokens/receive" } : { to: "/wallet" };
        case "settings":
            return { to: "/profile" };
        case "recovery":
            return { to: "/profile/recovery" };
        case "notifications":
            return { to: "/notifications" };
        case "history":
            return { to: "/history" };
        case "monerium":
        case "monerium-callback": {
            const search: Record<string, string> = {};
            if (params.code) search.code = params.code;
            if (params.state) search.state = params.state;
            return { to: "/monerium/callback", search };
        }
        default:
            return { to: "/wallet" };
    }
}

/**
 * Route deep link params to the appropriate screen.
 * Called when the user is already authenticated.
 */
export function routeDeepLink(navigate: NavigateFn, params: DeepLinkParams) {
    // Special cases that need side-effects beyond simple navigation
    switch (params.action) {
        case "pair":
            routePairDeepLink(navigate, params);
            return;
        case "install":
            routeInstallDeepLink(navigate, params);
            return;
    }

    // All other actions map directly to a route
    const route = deepLinkToRoute(params);
    if (route) {
        navigate(route);
    }
}

function routePairDeepLink(navigate: NavigateFn, params: DeepLinkParams) {
    // Store the pairing ID and navigate to the pairing page
    if (params.id && params.id.length > 0 && params.id.length <= 128) {
        pendingActionsStore.getState().addAction({
            type: "pairing",
            pairingId: params.id,
        });
    } else {
        console.warn(
            "[DeepLink] Invalid pair params \u2014 id missing or out of bounds"
        );
    }
    navigate({
        to: "/pairing",
        search: params.mode ? { mode: params.mode } : { mode: "embedded" },
    });
}

function routeInstallDeepLink(navigate: NavigateFn, params: DeepLinkParams) {
    // User is authenticated \u2014 fire ensure call immediately (background)
    if (params.m && params.a) {
        authenticatedBackendApi.user.identity.ensure
            .post({
                merchantId: params.m,
                anonymousId: params.a,
            })
            .catch((error: unknown) => {
                console.error("[DeepLink] Install ensure failed:", error);
            });
    }
    navigate({ to: "/wallet" });
}

export async function initDeepLinks(navigate: NavigateFn): Promise<void> {
    if (!isTauri()) {
        return;
    }

    try {
        const { onOpenUrl, getCurrent } = await import(
            "@tauri-apps/plugin-deep-link"
        );

        // Handle cold start (app opened via deep link)
        try {
            const initialUrls = await getCurrent();
            if (initialUrls && initialUrls.length > 0) {
                const params = parseDeepLink(initialUrls[0]);
                if (params) {
                    setTimeout(
                        () => handleDeepLinkAction(navigate, params),
                        100
                    );
                }
            }
        } catch {
            // Ignore errors from getCurrent - may not be available on all platforms
        }

        // Handle warm/hot start (deep link while app is running)
        await onOpenUrl((urls: string[]) => {
            const url = urls[0];
            if (!url) return;

            const params = parseDeepLink(url);
            if (params) {
                handleDeepLinkAction(navigate, params);
            }
        });
    } catch (error) {
        console.error("[DeepLink] Failed to initialize deep links:", error);
    }
}
