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

/** A native launch with no `clientId` is a host integration bug: the host owns the identity. */
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
        // Tell the host, so its sheet closes instead of showing an error it cannot read.
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
    // A warmed page is activated by fragment, so per-tap params can arrive after mount.
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

    // Branding falls back to the merchant config unless the caller overrode it.
    const { data: config } = useMerchantResolvedConfig({ merchantId });

    // No `#p=` proof here, unlike the listener's builder: this page has no SDK
    // keypair to sign with.
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
            // Handed to the SDK: `navigator.share` does not exist in an Android
            // WebView, and the interaction has to be signed by the SDK keypair.
            share: () => returnToHost("share"),
            // Same reason, but the page carries on afterwards: a host does not
            // re-present it for a copy.
            copy: () => returnToHost("copy"),
            dismiss: async () => {
                // `redirectUrl` is web-only; a native host owns the outcome.
                if (returnToHost("dismiss")) return;
                if (redirectUrl) {
                    if (IS_TAURI) {
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
                // Parts of the iOS install path cannot run in a web view, so hand
                // control back to the SDK.
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
