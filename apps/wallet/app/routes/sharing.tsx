import type { SharingPageProduct } from "@frak-labs/core-sdk";
import { FrakContextManager } from "@frak-labs/core-sdk";
import {
    authenticatedBackendApi,
    clearConfirmation,
    clientIdStore,
    getSavedConfirmation,
    SharingPage,
    saveConfirmation,
    trackGenericEvent,
    useCopyToClipboardWithState,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type SharingSearch = {
    merchantId?: string;
    clientId?: string;
    link?: string;
    appName?: string;
    logoUrl?: string;
    products?: string;
    /** Shopify order ID - used by backend bridge to resolve clientId when cart attributes fail */
    orderId?: string;
    /** Shopify checkout token - correlates with web pixel purchase data */
    checkoutToken?: string;
};

export const Route = createFileRoute("/sharing")({
    validateSearch: (search: Record<string, unknown>): SharingSearch => ({
        merchantId:
            typeof search.merchantId === "string"
                ? search.merchantId
                : undefined,
        clientId:
            typeof search.clientId === "string"
                ? search.clientId
                : undefined,
        link: typeof search.link === "string" ? search.link : undefined,
        appName:
            typeof search.appName === "string" ? search.appName : undefined,
        logoUrl:
            typeof search.logoUrl === "string" ? search.logoUrl : undefined,
        products:
            typeof search.products === "string" ? search.products : undefined,
        orderId:
            typeof search.orderId === "string" ? search.orderId : undefined,
        checkoutToken:
            typeof search.checkoutToken === "string"
                ? search.checkoutToken
                : undefined,
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
        products: productsJson,
        orderId,
        checkoutToken,
    } = Route.useSearch();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const storeClientId = clientIdStore((s) => s.clientId);
    const { copy } = useCopyToClipboardWithState();

    // Immediate clientId from params or store
    const immediateClientId = paramClientId ?? storeClientId;

    // Fetch clientId from backend when not available directly but we have order info
    const { data: resolvedClientId } = useQuery({
        queryKey: [
            "order-client",
            merchantId,
            orderId,
            checkoutToken,
        ],
        queryFn: async () => {
            const { data, error } =
                await authenticatedBackendApi.user.identity[
                    "order-client"
                ].get({
                    query: {
                        merchantId: merchantId!,
                        orderId,
                        checkoutToken,
                    },
                });
            if (error) return null;
            return data.clientId;
        },
        enabled:
            !immediateClientId &&
            !!merchantId &&
            (!!orderId || !!checkoutToken),
    });

    const clientId = immediateClientId ?? resolvedClientId ?? undefined;

    // Parse products from JSON search param
    const products = useMemo<SharingPageProduct[]>(() => {
        if (!productsJson) return [];
        try {
            return JSON.parse(productsJson) as SharingPageProduct[];
        } catch {
            return [];
        }
    }, [productsJson]);

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
    const finalSharingLink = useMemo(() => {
        if (!(clientId && merchantId && link)) return null;
        return FrakContextManager.update({
            url: link,
            context: {
                v: 2,
                c: clientId,
                m: merchantId,
                t: Math.floor(Date.now() / 1000),
            },
        });
    }, [clientId, merchantId, link]);

    // Share mutation using the shared hook
    const { mutate: triggerSharing, isPending: isSharing } = useShareLink(
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

    const handleDismiss = () => {
        // Navigate back or close — on wallet this just goes to the home page
        navigate({ to: "/wallet" });
    };

    const handleShareAgain = () => {
        clearConfirmation();
        setShowConfirmation(false);
    };

    const handleInstall = useCallback(() => {
        if (!installUrl) return;
        navigate({ to: "/install", search: { m: merchantId, a: clientId ?? undefined } });
    }, [installUrl, merchantId, clientId, navigate]);

    return (
        <SharingPage
            appName={appName ?? ""}
            logoUrl={logoUrl}
            products={products}
            sharingLink={finalSharingLink}
            installUrl={installUrl}
            t={t}
            isSharing={isSharing}
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
