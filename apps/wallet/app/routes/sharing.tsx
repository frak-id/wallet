import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import type {
    AttributionParams,
    SharingPageProduct,
} from "@frak-labs/core-sdk";
import {
    authenticatedBackendApi,
    buildSharingLink,
    clearConfirmation,
    clientIdStore,
    getSavedConfirmation,
    openExternalUrl,
    SharingPage,
    saveConfirmation,
    sessionStore,
    sharingKey,
    trackEvent,
    useCopyToClipboardWithState,
    useFormattedEstimatedReward,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useStore } from "zustand";
import { useMerchantResolvedConfig } from "@/module/common/hook/useMerchantResolvedConfig";
import { sanitizeRedirectUrl } from "@/module/common/utils/sanitizeRedirectUrl";

/**
 * Build AttributionParams from search params.
 *
 * Accepts either a JSON-encoded `attribution` param (for SDK-driven navigation)
 * or individual `utm_*` / `ref` / `via` params (for direct merchant links).
 * Returns `null` when the merchant explicitly disables attribution via `attribution=null`.
 */
function parseAttributionFromSearch(
    search: Record<string, unknown>
): AttributionParams | null | undefined {
    const raw = search.attribution;
    if (raw === null) return null;
    if (raw && typeof raw === "object") {
        return raw as AttributionParams;
    }

    const pick = (key: string): string | undefined =>
        typeof search[key] === "string" ? (search[key] as string) : undefined;

    const fromIndividual: AttributionParams = {
        utmSource: pick("utm_source"),
        utmMedium: pick("utm_medium"),
        utmCampaign: pick("utm_campaign"),
        utmContent: pick("utm_content"),
        utmTerm: pick("utm_term"),
        via: pick("via"),
        ref: pick("ref"),
    };
    const hasAny = Object.values(fromIndividual).some((v) => v !== undefined);
    return hasAny ? fromIndividual : undefined;
}
type SharingSearch = {
    merchantId?: string;
    clientId?: string;
    link?: string;
    appName?: string;
    logoUrl?: string;
    products?: SharingPageProduct[];
    /** Shopify checkout token — fallback to resolve clientId when the `_frak-client-id` cart attribute is missing */
    checkoutToken?: string;
    /** Redirect URL for post-dismiss navigation (e.g. Shopify storefront) */
    redirectUrl?: string;
    /** Attribution overrides for the outbound sharing URL (UTMs, ref, via). */
    attribution?: AttributionParams | null;
    /**
     * Set by a native host embedding this page in its own sheet.
     *
     * Drives two things: `clientId` becomes mandatory (the host owns the
     * caller identity) and the page renders without its own chrome, since
     * the host supplies a header and share controls of its own.
     */
    native?: boolean;
    /**
     * Open directly on the post-share confirmation screen.
     *
     * Under `native` the page's own share and copy buttons are hidden, and
     * they are the only things that flip that screen on. The host reloads
     * this URL with the flag once its share sheet completes, so the install
     * step still happens.
     */
    confirmed?: boolean;
};

export const Route = createFileRoute("/sharing")({
    validateSearch: (search: Record<string, unknown>): SharingSearch => ({
        merchantId:
            typeof search.merchantId === "string"
                ? search.merchantId
                : undefined,
        clientId:
            typeof search.clientId === "string" ? search.clientId : undefined,
        link: typeof search.link === "string" ? search.link : undefined,
        appName:
            typeof search.appName === "string" ? search.appName : undefined,
        logoUrl:
            typeof search.logoUrl === "string" ? search.logoUrl : undefined,
        products:
            typeof search.products === "object"
                ? (search.products as SharingPageProduct[])
                : undefined,
        checkoutToken:
            typeof search.checkoutToken === "string"
                ? search.checkoutToken
                : undefined,
        redirectUrl: sanitizeRedirectUrl(search.redirectUrl),
        attribution: parseAttributionFromSearch(search),
        native: search.native === "1" || search.native === true,
        confirmed: search.confirmed === "1" || search.confirmed === true,
    }),
    beforeLoad: ({ search }) => {
        // A native host owns the caller identity, so a missing `clientId` is a
        // host integration bug, not a state to render: the page would come up
        // with share and copy inert and no install link, saying nothing about
        // why. Rejecting here keeps it out of the funnel numbers and away from
        // the identity-resolution queries below.
        if (!(search.native && !search.clientId)) return;

        throw new Error(
            "sharing: `clientId` is required when `native` is set. The host owns the caller identity; the wallet's own stored id must not stand in for it."
        );
    },
    component: WalletSharingPage,
});

function WalletSharingPage() {
    const {
        merchantId,
        clientId: paramClientId,
        link,
        appName,
        logoUrl,
        products,
        checkoutToken,
        redirectUrl,
        attribution,
        native,
        confirmed,
    } = Route.useSearch();
    const { t: rawT } = useTranslation();
    const navigate = useNavigate();
    const storeClientId = useStore(clientIdStore, (s) => s.clientId);
    const walletAddress = useStore(sessionStore, (s) => s.session?.address);
    const { copy } = useCopyToClipboardWithState();

    // Product selection state — default to first product
    const [selectedProductIndex, setSelectedProductIndex] = useState(0);

    const { data: reward, isLoading: isRewardLoading } =
        useFormattedEstimatedReward({
            merchantId,
        });
    const estimatedReward = reward?.formatted;

    // Fire `sharing_page_viewed` once per mount, independent of whether we end up
    // rendering the confirmation screen. Denominator for the sharing funnel.
    useEffect(() => {
        trackEvent("sharing_page_viewed", { merchant_id: merchantId });
    }, [merchantId]);

    // Fetch backend-driven merchant config to source attribution defaults
    const { data: defaultAttribution } = useMerchantResolvedConfig({
        merchantId,
        select: (config) => config?.sdkConfig?.attribution,
    });

    // Wrap t to inject estimatedReward + productName into i18n interpolation
    const t = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            rawT(key, {
                ...options,
                estimatedReward: estimatedReward ?? "",
                productName: appName ?? "",
            }),
        [rawT, estimatedReward, appName]
    );

    // Whether this page may resolve a caller identity for itself.
    //
    // `clientIdStore` is a single global slot, not keyed by merchant, so it can
    // hold an id belonging to a different merchant than the one being shared,
    // and `checkoutToken` is a Shopify affordance. A native host states the
    // identity outright, so either substitute would build `installUrl` — and
    // the `ensure` that follows — against the wrong one, with no visible
    // symptom. Both fallbacks below hang off this single value.
    const mayResolveIdentity = !native;

    const immediateClientId = mayResolveIdentity
        ? (paramClientId ?? storeClientId)
        : paramClientId;

    // Fallback: resolve clientId from the backend via checkout token when not directly provided
    const { data: resolvedClientId } = useQuery({
        queryKey: sharingKey.orderClient(merchantId, checkoutToken),
        queryFn: async () => {
            if (!merchantId || !checkoutToken) return null;
            const { data, error } = await authenticatedBackendApi.user.identity[
                "order-client"
            ].get({
                query: {
                    merchantId,
                    checkoutToken,
                },
            });
            if (error) throw error;
            return data.clientId;
        },
        enabled:
            mayResolveIdentity &&
            !immediateClientId &&
            !!merchantId &&
            !!checkoutToken,
        retry: 5,
        retryDelay: 300,
    });

    const clientId = immediateClientId ?? resolvedClientId ?? undefined;

    // Compute the install URL pointing to the /install route
    const installUrl = useMemo(() => {
        if (!(merchantId && clientId)) return null;
        return `/install?m=${encodeURIComponent(merchantId)}&a=${encodeURIComponent(clientId)}`;
    }, [merchantId, clientId]);

    // Check sessionStorage for a recent confirmation. A host that completed a
    // share in its own sheet says so via the URL, since the in-page buttons
    // that would otherwise set this are hidden.
    const [showConfirmation, setShowConfirmation] = useState(
        () =>
            confirmed || (merchantId ? getSavedConfirmation(merchantId) : false)
    );

    // Build the final sharing link with Frak context via shared helper.
    // Use the selected product's link if available, otherwise fall back to default.
    const finalSharingLink = useMemo(() => {
        const safeProducts = products ?? [];
        const selectedProduct = safeProducts[selectedProductIndex];
        return buildSharingLink({
            clientId,
            merchantId,
            wallet: walletAddress,
            baseUrl: selectedProduct?.link ?? link,
            attribution,
            defaultAttribution: defaultAttribution ?? undefined,
            productUtmContent: selectedProduct?.utmContent,
        });
    }, [
        clientId,
        merchantId,
        walletAddress,
        link,
        products,
        selectedProductIndex,
        attribution,
        defaultAttribution,
    ]);

    // Share mutation using the shared hook (auto-fires `sharing_link_shared`).
    const {
        mutate: triggerSharing,
        isPending: isSharing,
        canShare,
    } = useShareLink(
        finalSharingLink,
        {
            title: t("sharing.title"),
            text: t("sharing.text"),
            // `logoUrl` comes from the merchant's config and drives the
            // rich preview header (iOS LinkPresentation / Android chooser
            // thumbnail). Falls back gracefully when the merchant has no
            // logo configured.
            imageUrl: logoUrl,
        },
        {
            source: "sharing_page_wallet",
            merchantId,
            onSuccess: (result) => {
                if (!result) return;
                toast.success(t("sharing.btn.shareSuccess"));
                if (merchantId) saveConfirmation(merchantId);
                setShowConfirmation(true);
            },
        }
    );

    const handleShare = () => {
        if (!finalSharingLink) return;
        triggerSharing();
    };

    const handleCopy = () => {
        if (!finalSharingLink) return;
        copy(finalSharingLink);
        trackEvent("sharing_link_copied", {
            source: "sharing_page_wallet",
            merchant_id: merchantId,
            link: finalSharingLink,
        });
        toast.success(t("sharing.btn.copySuccess"));
        if (merchantId) saveConfirmation(merchantId);
        setShowConfirmation(true);
    };

    const handleDismiss = async () => {
        if (redirectUrl) {
            if (IS_TAURI) {
                // In Tauri, open the redirect URL in the external browser
                // and navigate back to the wallet home.
                await openExternalUrl(redirectUrl);
                navigate({ to: "/wallet", replace: true });
                return;
            }
            window.location.assign(redirectUrl);
            return;
        }
        // Navigate back or close — on wallet this just goes to the home page
        navigate({ to: "/wallet", replace: true });
    };

    const handleShareAgain = () => {
        clearConfirmation();
        setShowConfirmation(false);
    };

    const handleInstall = useCallback(() => {
        if (!installUrl) return;
        navigate({
            to: "/install",
            search: { m: merchantId, a: clientId ?? undefined },
        });
    }, [installUrl, merchantId, clientId, navigate]);

    return (
        <SharingPage
            appName={appName ?? ""}
            logoUrl={logoUrl}
            products={products ?? []}
            selectedProductIndex={selectedProductIndex}
            onProductSelect={setSelectedProductIndex}
            sharingLink={finalSharingLink}
            installUrl={installUrl}
            t={t}
            isSharing={isSharing}
            isRewardLoading={isRewardLoading}
            rewardType={reward?.payoutType}
            minPurchaseAmount={reward?.minPurchaseAmount}
            lockupDurationDays={reward?.lockupDurationDays}
            rewardBreakdown={{
                referrer: reward?.referrerReward,
                referee: reward?.refereeReward,
                minPurchaseValue: reward?.minPurchaseValue,
            }}
            canShare={canShare}
            chromeless={native}
            showConfirmation={showConfirmation}
            onShare={handleShare}
            onCopy={handleCopy}
            onDismiss={handleDismiss}
            onShareAgain={handleShareAgain}
            onInstall={handleInstall}
            onConfirmationDismiss={handleDismiss}
        />
    );
}
