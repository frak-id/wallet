import { isTauri } from "@frak-labs/app-essentials/utils/platform";

type DeepLinkParams = {
    action: string;
    to?: string;
    amount?: string;
    returnUrl?: string;
    merchantId?: string;
    state?: string;
    merchantName?: string;
};

function extractSearchParams(
    searchParams: URLSearchParams
): Omit<DeepLinkParams, "action"> {
    return {
        to: searchParams.get("to") ?? undefined,
        amount: searchParams.get("amount") ?? undefined,
        returnUrl: searchParams.get("returnUrl") ?? undefined,
        merchantId: searchParams.get("merchantId") ?? undefined,
        state: searchParams.get("state") ?? undefined,
        merchantName: searchParams.get("merchantName") ?? undefined,
    };
}

function parseDeepLink(url: string): DeepLinkParams | null {
    try {
        const parsed = new URL(url);

        // frakwallet://login?returnUrl=...
        if (parsed.protocol === "frakwallet:") {
            const action =
                parsed.hostname || parsed.pathname.replace(/^\//, "") || "home";
            return { action, ...extractSearchParams(parsed.searchParams) };
        }

        // https://wallet.frak.id/open/login?returnUrl=...
        if (parsed.pathname.startsWith("/open")) {
            const pathAfterOpen = parsed.pathname
                .replace("/open/", "")
                .replace("/open", "");
            const action = pathAfterOpen || "home";
            return {
                action,
                ...extractSearchParams(parsed.searchParams),
            };
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

function handleDeepLinkAction(navigate: NavigateFn, params: DeepLinkParams) {
    switch (params.action) {
        case "send":
            navigate({
                to: "/tokens/send",
                search: params.to ? { to: params.to } : undefined,
            });
            break;

        case "receive":
            navigate({ to: "/tokens/receive" });
            break;

        case "settings":
            navigate({ to: "/settings" });
            break;

        case "recovery":
            navigate({ to: "/settings/recovery" });
            break;

        case "notifications":
            navigate({ to: "/notifications" });
            break;

        case "history":
            navigate({ to: "/history" });
            break;

        case "login":
            navigate({
                to: "/open/login",
                search: {
                    ...(params.returnUrl && { returnUrl: params.returnUrl }),
                    ...(params.merchantId && { merchantId: params.merchantId }),
                    ...(params.state && { state: params.state }),
                    ...(params.merchantName && {
                        merchantName: params.merchantName,
                    }),
                },
            });
            break;

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
