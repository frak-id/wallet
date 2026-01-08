import { isTauri } from "@frak-labs/app-essentials/utils/platform";

type DeepLinkParams = {
    action: string;
    to?: string;
    amount?: string;
    returnUrl?: string;
    productId?: string;
    state?: string;
    productName?: string;
};

function parseDeepLink(url: string): DeepLinkParams | null {
    try {
        const parsed = new URL(url);

        // frakwallet://send?to=0x... -> hostname is action
        if (parsed.protocol === "frakwallet:") {
            const action =
                parsed.hostname || parsed.pathname.replace(/^\//, "") || "home";
            return {
                action,
                to: parsed.searchParams.get("to") ?? undefined,
                amount: parsed.searchParams.get("amount") ?? undefined,
            };
        }

        // https://wallet.frak.id/open/send?to=...
        if (parsed.pathname.startsWith("/open")) {
            const pathAfterOpen = parsed.pathname
                .replace("/open/", "")
                .replace("/open", "");
            const action = pathAfterOpen || "home";
            return {
                action,
                to: parsed.searchParams.get("to") ?? undefined,
                amount: parsed.searchParams.get("amount") ?? undefined,
                returnUrl: parsed.searchParams.get("returnUrl") ?? undefined,
                productId: parsed.searchParams.get("productId") ?? undefined,
                state: parsed.searchParams.get("state") ?? undefined,
                productName:
                    parsed.searchParams.get("productName") ?? undefined,
            };
        }

        return null;
    } catch {
        console.error("Failed to parse deep link:", url);
        return null;
    }
}

type NavigateFn = (options: {
    to: string;
    search?: Record<string, string>;
}) => unknown;

function handleDeepLinkAction(navigate: NavigateFn, params: DeepLinkParams) {
    console.log("[DeepLink] Handling action:", params);

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
                    ...(params.productId && { productId: params.productId }),
                    ...(params.state && { state: params.state }),
                    ...(params.productName && {
                        productName: params.productName,
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
                console.log(
                    "[DeepLink] App opened via deep link:",
                    initialUrls
                );
                const params = parseDeepLink(initialUrls[0]);
                if (params) {
                    setTimeout(
                        () => handleDeepLinkAction(navigate, params),
                        100
                    );
                }
            }
        } catch {
            console.log("[DeepLink] No initial deep link");
        }

        // Handle warm/hot start (deep link while app is running)
        await onOpenUrl((urls: string[]) => {
            console.log("[DeepLink] Received deep link:", urls);
            const url = urls[0];
            if (!url) return;

            const params = parseDeepLink(url);
            if (params) {
                handleDeepLinkAction(navigate, params);
            }
        });

        console.log("[DeepLink] Deep link handler initialized");
    } catch (error) {
        console.error("[DeepLink] Failed to initialize deep links:", error);
    }
}
