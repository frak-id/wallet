import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import {
    buildInstallUrl,
    openExternalUrl,
    SharingPage,
    sessionStore,
    useSharingPageController,
} from "@frak-labs/wallet-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { useStore } from "zustand";
import { useMerchantResolvedConfig } from "@/module/common/hook/useMerchantResolvedConfig";
import { isHostEmbedded } from "@/module/common/utils/hostEmbed";
import { sendHostResult } from "@/module/sharing/host/bridge";
import { useHostBridge } from "@/module/sharing/host/useHostBridge";
import { useActivationParams } from "@/module/sharing/params/fragment";
import { parseSharingSearch } from "@/module/sharing/params/search";
import type { SharingSearch } from "@/module/sharing/params/table";
import { useSharingIdentity } from "@/module/sharing/useSharingIdentity";

/**
 * A native launch with no `clientId` is a host integration bug rather than a
 * state to render — the host owns the caller identity and the wallet's own
 * stored id must not stand in for it.
 *
 * Thrown from `beforeLoad` and caught by `errorComponent`, which is where the
 * host is told. Guards are re-entrant (the router re-resolves the location
 * whenever `validateSearch` rewrites the URL), so a guard that navigated would
 * fire the same outcome twice; a component renders once.
 */
class MissingHostClientIdError extends Error {
    constructor(
        readonly returnScheme: string | undefined,
        readonly sid: string | undefined
    ) {
        super(
            "sharing: `clientId` is required when `embed` is set. The host owns the caller identity; the wallet's own stored id must not stand in for it."
        );
        this.name = "MissingHostClientIdError";
    }
}

export const Route = createFileRoute("/sharing")({
    validateSearch: parseSharingSearch,
    beforeLoad: ({ search }: { search: SharingSearch }) => {
        if (search.embed && !search.clientId) {
            throw new MissingHostClientIdError(search.returnScheme, search.sid);
        }
    },
    errorComponent: ({ error }) => {
        // Tell the host, so its sheet closes instead of hanging on a
        // wallet-branded error page it cannot interpret.
        if (error instanceof MissingHostClientIdError) {
            sendHostResult({
                scheme: error.returnScheme,
                action: "error",
                sid: error.sid,
            });
            return null;
        }
        throw error;
    },
    component: WalletSharingPage,
});

function WalletSharingPage() {
    const search = Route.useSearch();
    // A warmed page is activated by fragment, so the per-tap params can arrive
    // after mount. Merging here means every consumer below sees one view and
    // none of them has to know which half of the URL its value came from.
    const activation = useActivationParams(!!search.embed);
    const {
        merchantId,
        clientId: paramClientId,
        link,
        appName,
        logoUrl,
        products,
        checkoutToken,
        redirectUrl,
        embed,
        returnScheme,
        sid,
        sdkVersion,
        seedReward,
        state,
        view,
    } = { ...search, ...activation };

    const { t: rawT } = useTranslation();
    const navigate = useNavigate();
    const walletAddress = useStore(sessionStore, (s) => s.session?.address);

    const embedded = isHostEmbedded(embed);
    const warm = state === "warm";

    const { returnToHost, canHandOff } = useHostBridge({
        returnScheme,
        sid,
        warm,
    });

    const clientId = useSharingIdentity({
        merchantId,
        clientId: paramClientId,
        checkoutToken,
        embedded,
    });

    // Merchant config supplies the branding, so a caller only sends `appName`
    // / `logoUrl` when it wants to override it.
    const { data: config } = useMerchantResolvedConfig({ merchantId });

    // Compute the install URL pointing to the /install route.
    //
    // No `#p=` proof here, unlike the listener's builder: this page's
    // `clientId` arrives from a URL param, the wallet's own store, or a
    // backend lookup by checkout token — never from the SDK keypair that could
    // sign for it. Nothing to sign with, so this arm stays a bare id.
    const installUrl = useMemo(() => {
        if (!(merchantId && clientId)) return null;
        return buildInstallUrl({ merchantId, clientId });
    }, [merchantId, clientId]);

    const controller = useSharingPageController({
        merchantId,
        clientId,
        wallet: walletAddress,
        link,
        products,
        merchant: {
            name: appName ?? config?.sdkConfig?.name ?? config?.name,
            logoUrl: logoUrl ?? config?.sdkConfig?.logoUrl ?? undefined,
        },
        defaultAttribution: config?.sdkConfig?.attribution ?? undefined,
        seedReward,
        source: "sharing_page_wallet",
        installUrl,
        chrome: embedded ? { mode: "none" } : { mode: "full" },
        confirmed: view === "confirmation",
        warm,
        sdkVersion,
        canHandOffShare: canHandOff,
        t: rawT,
        outcomes: {
            // The SDK owns the share itself, for two reasons this page cannot
            // work around: `navigator.share` does not exist in an Android
            // WebView, and the interaction a share earns has to be signed by
            // the SDK keypair. The host re-presents this page as confirmed
            // once its chooser is up.
            share: () => returnToHost("share"),
            // Handed off for the interaction half of the same reason — a
            // WebView clipboard write would work, but the SDK still has to be
            // the one to record the sharing interaction. Unlike `share` the
            // page carries on afterwards: a host does not re-present the page
            // for a copy, precisely so the toast and confirmation screen
            // survive.
            copy: () => returnToHost("copy"),
            dismiss: async () => {
                // A native host owns the outcome: `redirectUrl` is a web-only
                // concern and is not sent in native mode.
                if (returnToHost("dismiss")) return;
                if (redirectUrl) {
                    if (IS_TAURI) {
                        // In Tauri, open the redirect in the external browser
                        // and navigate back to the wallet home.
                        await openExternalUrl(redirectUrl);
                        navigate({ to: "/wallet", replace: true });
                        return;
                    }
                    window.location.assign(redirectUrl);
                    return;
                }
                navigate({ to: "/wallet", replace: true });
            },
            shareAgain: () => {
                returnToHost("shareAgain");
            },
            install: () => {
                // The SDK owns the whole install step: parts of the iOS path
                // (a timed pasteboard entry, the in-app App Store sheet)
                // cannot run in a web view, so hand back control instead of
                // navigating directly.
                if (returnToHost("install")) return;
                if (!installUrl) return;
                navigate({
                    to: "/install",
                    search: { m: merchantId, a: clientId ?? undefined },
                });
            },
        },
    });

    return (
        <>
            <Toaster position="top-center" />
            <SharingPage {...controller} />
        </>
    );
}
