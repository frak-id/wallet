import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { openExternalUrl } from "@frak-labs/wallet-shared/common/utils/openExternalUrl";
import { translationKeyPathToObject } from "@frak-labs/wallet-shared/common/utils/translationKeyPathToObject";
import {
    buildInstallUrl,
    SharingPage,
    useSharingIdentity,
    useSharingPageController,
} from "@frak-labs/wallet-shared/sharing";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Toaster } from "sonner";
import { useStore } from "zustand";
import { useMerchantResolvedConfig } from "@/module/common/hook/useMerchantResolvedConfig";
import { isHostEmbedded } from "@/module/common/utils/hostEmbed";
import { useHostBridge } from "@/module/sharing/host/useHostBridge";
import { useActivationParams } from "@/module/sharing/params/fragment";
import type { SharingSearch } from "@/module/sharing/params/table";

/**
 * How this surface leaves the page. The SPA route hands over TanStack Router
 * navigations; the standalone `/sharing` entrypoint has no router and does
 * document navigations instead.
 */
export type SharingNavigation = {
    /** Go to the install page, carrying whichever credential this page holds. */
    toInstall: (params: {
        merchantId?: string;
        // No `clientId`: this page holds no keypair, so it never carries one.
        checkoutToken?: string;
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

    const { i18n } = useTranslation();
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

    // Merged into a clone, never the shared instance: `addResourceBundle` deep-merges
    // into a page-lifetime singleton, so one merchant's overrides would outlive them and
    // land on the next. Building it during render also keeps `t` in step with the config,
    // which a store mutation would not — nothing re-renders on one.
    const t = useMemo(() => {
        const lng = i18n.resolvedLanguage ?? i18n.language;
        const translations = config?.sdkConfig?.translations;
        if (!translations || Object.keys(translations).length === 0) {
            return i18n.getFixedT(lng, null);
        }
        const scoped = i18n.cloneInstance({
            lng,
            // Without this the clone shares the parent's store and the merge is still global.
            forkResourceStore: true,
            // Nothing to fetch once the store is forked: init synchronously rather than
            // racing an async init queued behind this render.
            initAsync: false,
            partialBundledLanguages: false,
        });
        scoped.addResourceBundle(
            lng,
            "customized",
            translationKeyPathToObject(translations),
            true,
            true
        );
        return scoped.getFixedT(lng, null);
    }, [config?.sdkConfig?.translations, i18n, i18n.resolvedLanguage]);

    // Neither credential travels from here: this page has no SDK keypair, so
    // it can sign no `#p=` proof, and an unprovable `a=` is refused once
    // ensure demands one. Gate 2's `checkoutToken` is the exception. The link
    // is still built without either, or the store CTA behind it goes dead.
    const installUrl = useMemo(() => {
        if (!merchantId) return null;
        return buildInstallUrl({
            merchantId,
            checkoutToken,
            allowCredentialless: true,
        });
    }, [merchantId, checkoutToken]);

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
        t,
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
                navigation.toInstall({
                    merchantId,
                    checkoutToken,
                    installUrl,
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
