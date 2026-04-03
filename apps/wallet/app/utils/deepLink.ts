import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { getSafeSession } from "@frak-labs/wallet-shared";
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
 * Routes that bypass the auth gate.
 * These actions always reach `routeDeepLink` regardless of session state,
 * so the destination page handles its own auth logic.
 */
const publicActions = new Set(["register", "login", "recovery", "install"]);

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
    const target = deepLinkToRoute(params);
    if (target) {
        pendingActionsStore.getState().addAction({
            type: "navigation",
            to: target.to,
            search: target.search,
        });
    }
}

type Route = { to: string; search?: Record<string, string> };

/**
 * Resolve a monerium OAuth callback deep link.
 */
const resolveMoneriumRoute = (params: DeepLinkParams): Route => {
    const search: Record<string, string> = {};
    if (params.code) search.code = params.code;
    if (params.state) search.state = params.state;
    return { to: "/monerium/callback", search };
};

/**
 * Action → route resolver map.
 *
 * Each entry maps a deep link action name to a function that builds
 * the target route. Keeps `deepLinkToRoute` trivial and under the
 * cognitive complexity limit.
 */
const routeResolvers: Record<string, (params: DeepLinkParams) => Route> = {
    pair: (params) =>
        params.id && params.id.length > 0 && params.id.length <= 128
            ? {
                  to: "/pairing",
                  search: {
                      id: params.id,
                      mode: params.mode ?? "embedded",
                  },
              }
            : { to: "/wallet" },
    install: (params) => {
        const search: Record<string, string> = {};
        if (params.m) search.m = params.m;
        if (params.a) search.a = params.a;
        return { to: "/install", search };
    },
    send: (params) =>
        isCryptoMode
            ? {
                  to: "/tokens/send",
                  search: params.to ? { to: params.to } : undefined,
              }
            : { to: "/wallet" },
    receive: () =>
        isCryptoMode ? { to: "/tokens/receive" } : { to: "/wallet" },
    settings: () => ({ to: "/profile" }),
    recovery: () => ({ to: "/profile/recovery" }),
    notifications: () => ({ to: "/notifications" }),
    history: () => ({ to: "/history" }),
    monerium: resolveMoneriumRoute,
    "monerium-callback": resolveMoneriumRoute,
};

/**
 * Map deep link params to a route path + search params.
 */
function deepLinkToRoute(params: DeepLinkParams): Route {
    const resolver = routeResolvers[params.action];
    return resolver ? resolver(params) : { to: "/wallet" };
}

/**
 * Route deep link params to the appropriate screen.
 * Called when the user is already authenticated, or for public actions.
 */
export function routeDeepLink(navigate: NavigateFn, params: DeepLinkParams) {
    const route = deepLinkToRoute(params);
    if (route) {
        navigate(route);
    }
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
