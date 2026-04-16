import { isTauri } from "@frak-labs/app-essentials/utils/platform";
import type {
    AttributionParams,
    SharingPageProduct,
} from "@frak-labs/core-sdk";
import { FrakContextManager, mergeAttribution } from "@frak-labs/core-sdk";
import {
    authenticatedBackendApi,
    clearConfirmation,
    clientIdStore,
    getSavedConfirmation,
    SharingPage,
    saveConfirmation,
    trackGenericEvent,
    useCopyToClipboardWithState,
    useFormattedEstimatedReward,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

/**
 * Sanitize a redirect URL from search params to prevent open redirects.
 * Only allows valid https:// URLs, strips hash and query params.
 */
function sanitizeRedirectUrl(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    try {
        const url = new URL(value);
        if (url.protocol !== "https:") return undefined;
        return url.origin + url.pathname;
    } catch {
        return undefined;
    }
}

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
    }),
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
    } = Route.useSearch();
    const { t: rawT } = useTranslation();
    const navigate = useNavigate();
    const storeClientId = clientIdStore((s) => s.clientId);
    const { copy } = useCopyToClipboardWithState();

    // Product selection state — default to first product
    const [selectedProductIndex, setSelectedProductIndex] = useState(0);

    const { data: estimatedReward } = useFormattedEstimatedReward({
        merchantId,
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

    // Immediate clientId from params or store
    const immediateClientId = paramClientId ?? storeClientId;

    // Fallback: resolve clientId from the backend via checkout token when not directly provided
    const { data: resolvedClientId } = useQuery({
        queryKey: ["order-client", merchantId, checkoutToken],
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
        enabled: !immediateClientId && !!merchantId && !!checkoutToken,
        retry: 5,
        retryDelay: 300,
    });

    const clientId = immediateClientId ?? resolvedClientId ?? undefined;

    // Compute the install URL pointing to the /install route
    const installUrl = useMemo(() => {
        if (!(merchantId && clientId)) return null;
        return `/install?m=${encodeURIComponent(merchantId)}&a=${encodeURIComponent(clientId)}`;
    }, [merchantId, clientId]);

    // Check sessionStorage for a recent confirmation
    const [showConfirmation, setShowConfirmation] = useState(() =>
        merchantId ? getSavedConfirmation(merchantId) : false
    );

    // Build the final sharing link with Frak context
    // Use the selected product's link if available, otherwise fall back to default
    const finalSharingLink = useMemo(() => {
        if (!(clientId && merchantId)) return null;

        const safeProducts = products ?? [];
        const selectedProduct = safeProducts[selectedProductIndex];
        const baseLink = selectedProduct?.link ?? link;
        if (!baseLink) return null;

        const resolvedAttribution = mergeAttribution({
            perCall: attribution,
            productUtmContent: selectedProduct?.utmContent,
        });

        return FrakContextManager.update({
            url: baseLink,
            context: {
                v: 2,
                c: clientId,
                m: merchantId,
                t: Math.floor(Date.now() / 1000),
            },
            attribution: resolvedAttribution,
        });
    }, [
        clientId,
        merchantId,
        link,
        products,
        selectedProductIndex,
        attribution,
    ]);

    // Share mutation using the shared hook
    const {
        mutate: triggerSharing,
        isPending: isSharing,
        canShare,
    } = useShareLink(
        finalSharingLink,
        {
            title: t("sharing.title"),
            text: t("sharing.text"),
        },
        {
            onSuccess: (result) => {
                if (!result) return;
                toast.success(t("sharing.btn.shareSuccess"));
                trackGenericEvent("sharing-share-link", {
                    link: finalSharingLink,
                });
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
        trackGenericEvent("sharing-copy-link", {
            link: finalSharingLink,
        });
        toast.success(t("sharing.btn.copySuccess"));
        if (merchantId) saveConfirmation(merchantId);
        setShowConfirmation(true);
    };

    const handleDismiss = async () => {
        if (redirectUrl) {
            if (isTauri()) {
                // In Tauri, open the redirect URL in the external browser
                // and navigate back to the wallet home.
                const { openUrl } = await import("@tauri-apps/plugin-opener");
                await openUrl(redirectUrl);
                navigate({ to: "/wallet" });
                return;
            }
            window.location.assign(redirectUrl);
            return;
        }
        // Navigate back or close — on wallet this just goes to the home page
        navigate({ to: "/wallet" });
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
            canShare={canShare}
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
