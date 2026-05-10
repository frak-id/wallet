import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import {
    type DeepLinkSource,
    getSafeSession,
    recordError,
    trackEvent,
} from "@frak-labs/wallet-shared";
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
 * Custom URL schemes registered by the wallet variants.
 * - Prod app (id.frak.wallet) registers `frakwallet://`
 * - Dev app  (id.frak.wallet.dev) registers `frakwallet-dev://`
 *
 * Each variant only ever receives its own scheme from the OS, but we accept
 * both here so a single source file works for any build without rebuild-only
 * branching.
 */
const customDeepLinkProtocols = new Set(["frakwallet:", "frakwallet-dev:"]);

/**
 * Known wallet hosts that trigger App Link handling on Android.
 * When the OS opens the app via a verified HTTPS link, the URL arrives
 * here as an `https://` deep link instead of the custom scheme.
 */
const knownWalletHosts = new Set(["wallet.frak.id", "wallet-dev.frak.id"]);

function parseDeepLink(url: string): DeepLinkParams | null {
    try {
        const parsed = new URL(url);

        // frakwallet://pair?id=...&mode=embedded (prod variant)
        // frakwallet-dev://pair?id=...&mode=embedded (dev variant)
        // frakwallet://p/<UPPER_HEX> (compact QR alias)
        if (customDeepLinkProtocols.has(parsed.protocol)) {
            const pathSegments = parsed.pathname
                .replace(/^\//, "")
                .split("/")
                .filter(Boolean);
            const action = parsed.hostname || pathSegments[0] || "home";
            // For frakwallet://<host>/<rest>, the id is pathSegments[0];
            // for frakwallet:///<action>/<id> (no host), it's pathSegments[1].
            const pathId = parsed.hostname ? pathSegments[0] : pathSegments[1];
            return buildParams(action, pathId, parsed.searchParams);
        }

        // https://wallet.frak.id/pair?id=... (Android App Links)
        // https://wallet.frak.id/p/<UPPER_HEX> (compact QR alias)
        if (
            parsed.protocol === "https:" &&
            knownWalletHosts.has(parsed.hostname)
        ) {
            const pathSegments = parsed.pathname
                .replace(/^\//, "")
                .split("/")
                .filter(Boolean);
            const action = pathSegments[0] || "home";
            const pathId = pathSegments[1];
            return buildParams(action, pathId, parsed.searchParams);
        }

        return null;
    } catch (error) {
        recordError(error, { source: "deep_link", context: { url } });
        return null;
    }
}

/**
 * Build deep-link params, folding a path-segment id into `params.id` for
 * compact `/p/<id>` aliases. The id is lowercased so backend lookups
 * (byte-exact on a `varchar` column) always see the canonical form.
 */
function buildParams(
    action: string,
    pathId: string | undefined,
    searchParams: URLSearchParams
): DeepLinkParams {
    // Action lookup is case-sensitive (object key match), but URL paths are
    // not normalized by browsers/OS deep-link plumbing — fold to lowercase so
    // `/PAIR`, `/Pair`, `/pair` all resolve identically.
    const normalizedAction = action.toLowerCase();
    const params = extractSearchParams(searchParams);
    const id =
        normalizedAction === "p" && !params.id && pathId
            ? pathId.toLowerCase()
            : params.id;
    return { action: normalizedAction, ...params, id };
}

type NavigateFn = (options: {
    to: string;
    search?: Record<string, string>;
    replace?: boolean;
}) => unknown;

/**
 * Routes that bypass the auth gate.
 * These actions always reach `routeDeepLink` regardless of session state,
 * so the destination page handles its own auth logic.
 */
const publicActions = new Set(["register", "login", "recovery", "install"]);

function handleDeepLinkAction(
    navigate: NavigateFn,
    params: DeepLinkParams,
    source: DeepLinkSource
) {
    const isPublic = publicActions.has(params.action);
    const session = isPublic ? null : getSafeSession();
    const gated = !isPublic && !session?.token;

    trackEvent("deep_link_received", {
        source,
        action: params.action,
        gated,
    });

    if (gated) {
        // Convert deep link to typed pending actions in the store
        storePendingActions(params);
        // Replace so the deep link doesn't leave a /register entry that
        // back-navigation could surface after the post-auth redirect.
        navigate({ to: "/register", replace: true });
        return;
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
 * Resolve a pairing deep link. Aliased under `pair`, `pairing`, and the
 * compact `p` action — the `p` form encodes the id in the path (`/p/<id>`)
 * so the QR payload stays short & QR-alphanumeric.
 */
const resolvePairRoute = (params: DeepLinkParams): Route =>
    params.id && params.id.length > 0 && params.id.length <= 128
        ? {
              to: "/pairing",
              search: {
                  id: params.id,
                  mode: params.mode ?? "embedded",
              },
          }
        : { to: "/wallet" };

/**
 * Action → route resolver map.
 *
 * Each entry maps a deep link action name to a function that builds
 * the target route. Keeps `deepLinkToRoute` trivial and under the
 * cognitive complexity limit.
 */
const routeResolvers: Record<string, (params: DeepLinkParams) => Route> = {
    p: resolvePairRoute,
    pair: resolvePairRoute,
    pairing: resolvePairRoute,
    install: (params) => {
        const search: Record<string, string> = {};
        if (params.m) search.m = params.m;
        if (params.a) search.a = params.a;
        return { to: "/install", search };
    },
    send: (params) => ({
        to: "/tokens/send",
        search: params.to ? { to: params.to } : undefined,
    }),
    receive: () => ({ to: "/wallet" }),
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
        // Deep links are entry-point navigations, not part of an in-app flow,
        // so replace rather than push to keep the back-stack bounded.
        navigate({ ...route, replace: true });
    }
}

export async function initDeepLinks(navigate: NavigateFn): Promise<void> {
    if (!IS_TAURI) {
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
                const url = initialUrls[0];
                setTimeout(() => {
                    const params = parseDeepLink(url);
                    if (!params) return;
                    handleDeepLinkAction(navigate, params, "cold_start");
                }, 100);
            }
        } catch {
            // Ignore errors from getCurrent - may not be available on all platforms
        }

        // Handle warm/hot start (deep link while app is running)
        await onOpenUrl((urls: string[]) => {
            const url = urls[0];
            if (!url) return;
            const params = parseDeepLink(url);
            if (params) handleDeepLinkAction(navigate, params, "warm_start");
        });
    } catch (error) {
        recordError(error, {
            source: "deep_link",
            context: { stage: "init" },
        });
    }
}
