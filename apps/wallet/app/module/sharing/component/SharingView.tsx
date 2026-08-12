import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { openExternalUrl } from "@frak-labs/wallet-shared/common/utils/openExternalUrl";
import {
    buildInstallUrl,
    SharingPage,
    translationKeyPathToObject,
    useSharingPageController,
} from "@frak-labs/wallet-shared/sharing";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { useStore } from "zustand";
import { useMerchantResolvedConfig } from "@/module/common/hook/useMerchantResolvedConfig";
import { isHostEmbedded } from "@/module/common/utils/hostEmbed";
import { useHostBridge } from "@/module/sharing/host/useHostBridge";
import { useActivationParams } from "@/module/sharing/params/fragment";
import type { SharingSearch } from "@/module/sharing/params/table";
import { useSharingIdentity } from "@/module/sharing/useSharingIdentity";

/**
 * How this surface leaves the page. The SPA route hands over TanStack Router
 * navigations; the standalone `/sharing` entrypoint has no router and does
 * document navigations instead.
 */
export type SharingNavigation = {
    /** Go to the install page for this merchant/client pair. */
    toInstall: (params: {
        merchantId?: string;
        clientId?: string;
        /** Absolute URL built by `buildInstallUrl`, for surfaces without a router. */
        installUrl: string;
    }) => void;
    /** Go back to the wallet home. */
    toWallet: () => void;
};

/**
 * The sharing page, minus its param source and its router.
 *
 * Both the wallet SPA route and the standalone `/sharing` entrypoint render
 * this: every decision below is identical on the two surfaces, so keeping one
 * copy is what makes the standalone build a packaging change rather than a
 * behavioural fork.
 */
export function SharingView({
    search,
    navigation,
}: {
    search: SharingSearch;
    navigation: SharingNavigation;
}) {
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
        shareTitle,
        shareText,
        shareImage,
        state,
        view,
    } = { ...search, ...activation };

    const { t: rawT, i18n } = useTranslation();
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

    // A merchant's `sharing.title`/`sharing.text` overrides, which the listener
    // already merges for the embedded wallet UI but this standalone route did
    // not: `t()` below resolves `translation` -> `customized` -> `common`, so
    // adding the merchant's copy to `customized` is all that was missing.
    //
    // Removed on cleanup rather than only added. `addResourceBundle` deep-merges into a
    // page-lifetime singleton, so on the SPA route -- where `/sharing` is reachable without a
    // document load -- merchant A's overrides would otherwise still be in `customized` when
    // merchant B renders, and dropping an override server-side would never restore the default.
    useEffect(() => {
        const translations = config?.sdkConfig?.translations;
        if (!translations || Object.keys(translations).length === 0) return;
        const lng = i18n.language;
        const overrides = translationKeyPathToObject(translations);
        i18n.addResourceBundle(lng, "customized", overrides, true, true);
        return () => {
            for (const key of Object.keys(overrides)) {
                i18n.removeResourceBundle(lng, `customized.${key}`);
            }
        };
    }, [config?.sdkConfig?.translations, i18n]);

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
        shareTitle,
        shareText,
        shareImage,
        source: "sharing_page_wallet",
        installUrl,
        chrome: embedded ? { mode: "none" } : { mode: "full" },
        confirmed: view === "confirmation",
        warm,
        sdkVersion,
        canHandOff,
        t: rawT,
        outcomes: {
            // Handed to the SDK: `navigator.share` does not exist in an Android
            // WebView, and the interaction has to be signed by the SDK keypair.
            share: (data) =>
                returnToHost("share", {
                    title: data.title || undefined,
                    text: data.text || undefined,
                    image: data.imageUrl,
                }),
            // Same reason, but the page carries on afterwards: a host does not
            // re-present it for a copy.
            copy: () => returnToHost("copy"),
            dismiss: async () => {
                // `redirectUrl` is web-only; a native host owns the outcome.
                if (returnToHost("dismiss")) return;
                if (redirectUrl) {
                    if (IS_TAURI) {
                        await openExternalUrl(redirectUrl);
                        navigation.toWallet();
                        return;
                    }
                    window.location.assign(redirectUrl);
                    return;
                }
                navigation.toWallet();
            },
            shareAgain: () => {
                returnToHost("shareAgain");
            },
            install: () => {
                // Parts of the iOS install path cannot run in a web view, so
                // hand control back to the SDK.
                if (returnToHost("install")) return;
                if (!installUrl) return;
                navigation.toInstall({ merchantId, clientId, installUrl });
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
