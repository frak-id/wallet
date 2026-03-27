import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import { getSafeSession, pairingStore } from "@frak-labs/wallet-shared";
import { isCryptoMode } from "@/module/common/utils/walletMode";

type DeepLinkParams = {
    action: string;
    to?: string;
    amount?: string;
    id?: string;
    mode?: string;
    code?: string;
    state?: string;
};

/**
 * Pending deep link stored when user is unauthenticated.
 * Consumed by login/register pages after successful auth.
 */
let pendingDeepLink: DeepLinkParams | null = null;

export function getPendingDeepLink(): DeepLinkParams | null {
    return pendingDeepLink;
}

export function clearPendingDeepLink(): void {
    pendingDeepLink = null;
}

/**
 * After auth, consume the pending deep link and navigate to it.
 * Returns true if a pending deep link was consumed, false otherwise.
 */
export function consumePendingDeepLink(navigate: NavigateFn): boolean {
    const pending = pendingDeepLink;
    if (!pending) return false;

    pendingDeepLink = null;
    routeDeepLink(navigate, pending);
    return true;
}

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

        // https://wallet.v2.gcp-dev.frak.id/pair?id=... (Android App Links)
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
            // Store for post-auth redirect, set up pairing if needed
            if (params.action === "pair" && params.id) {
                pairingStore.getState().setPendingPairingId(params.id);
            }
            pendingDeepLink = params;
            navigate({ to: "/register" });
            return;
        }
    }

    routeDeepLink(navigate, params);
}

/**
 * Route deep link params to the appropriate screen.
 * Extracted so post-auth redirect can call it directly.
 */
export function routeDeepLink(navigate: NavigateFn, params: DeepLinkParams) {
    switch (params.action) {
        case "send":
            if (isCryptoMode) {
                navigate({
                    to: "/tokens/send",
                    search: params.to ? { to: params.to } : undefined,
                });
            } else {
                navigate({ to: "/wallet" });
            }
            break;

        case "receive":
            if (isCryptoMode) {
                navigate({ to: "/tokens/receive" });
            } else {
                navigate({ to: "/wallet" });
            }
            break;

        case "settings":
            navigate({ to: "/profile" });
            break;

        case "recovery":
            navigate({ to: "/profile/recovery" });
            break;

        case "notifications":
            navigate({ to: "/notifications" });
            break;

        case "history":
            navigate({ to: "/history" });
            break;

        case "pair":
            // Pairing codes are resolved server-side via /pairing; deep link only needs the id.
            if (params.id && params.id.length > 0 && params.id.length <= 128) {
                pairingStore.getState().setPendingPairingId(params.id);
            } else {
                console.warn(
                    "[DeepLink] Invalid pair params — id missing or out of bounds"
                );
            }
            navigate({
                to: "/pairing",
                search: params.mode
                    ? { mode: params.mode }
                    : { mode: "embedded" },
            });
            break;

        case "monerium":
        case "monerium-callback": {
            // Both HTTPS App Link (action: "monerium") and custom scheme (action: "monerium-callback")
            // route to the OAuth callback handler
            const search: Record<string, string> = {};
            if (params.code) search.code = params.code;
            if (params.state) search.state = params.state;
            navigate({ to: "/monerium/callback", search });
            break;
        }

        default:
            navigate({ to: "/wallet" });
            break;
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
