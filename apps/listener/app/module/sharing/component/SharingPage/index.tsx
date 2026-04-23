import type { SharingPageProduct } from "@frak-labs/core-sdk";
import {
    buildSharingLink,
    clearConfirmation,
    clientIdStore,
    emitLifecycleEvent,
    getSavedConfirmation,
    SharingPage,
    saveConfirmation,
    sessionStore,
    trackEvent,
    useCopyToClipboardWithState,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTrackSharing } from "@/module/hooks/useTrackSharing";
import {
    useListenerTranslation,
    useSharingListenerUI,
} from "@/module/providers/ListenerUiProvider";
import { useSafeResolvingContext } from "@/module/stores/hooks";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";

export function ListenerSharingPage() {
    const { currentRequest, clearRequest } = useSharingListenerUI();
    const { t } = useListenerTranslation();
    const { sourceUrl, merchantId } = useSafeResolvingContext();
    const defaultAttribution = resolvingContextStore(
        (s) => s.backendSdkConfig?.attribution
    );
    const clientId = clientIdStore((s) => s.clientId);
    const walletAddress = sessionStore((s) => s.session?.address);
    const { copy } = useCopyToClipboardWithState();
    const { mutate: trackSharing } = useTrackSharing();

    const hasResolvedRef = useRef(false);

    // Compute the install URL centrally
    const installUrl = useMemo(() => {
        if (!(merchantId && clientId)) return null;
        const baseUrl = window.location.origin;
        return `${baseUrl}/install?m=${encodeURIComponent(merchantId)}&a=${encodeURIComponent(clientId)}`;
    }, [merchantId, clientId]);

    // Check sessionStorage for a recent confirmation
    const [showConfirmation, setShowConfirmation] = useState(() =>
        merchantId ? getSavedConfirmation(merchantId) : false
    );

    // Fire `sharing_page_viewed` once per mount — denominator for the listener
    // sharing funnel. `sharing_page_opened` already fires in the RPC handler
    // when the iframe first receives the request; `sharing_page_viewed` fires
    // when the UI actually mounts, so both are useful (RPC vs. render).
    useEffect(() => {
        trackEvent("sharing_page_viewed", { merchant_id: merchantId });
    }, [merchantId]);

    // If we restore from sessionStorage, still resolve the RPC as "shared"
    // so the SDK consumer gets the result
    useEffect(() => {
        if (showConfirmation && !hasResolvedRef.current) {
            hasResolvedRef.current = true;
            currentRequest.emitter({
                result: {
                    action: "shared",
                    installUrl: installUrl ?? undefined,
                },
            });
        }
    }, [showConfirmation, currentRequest.emitter, installUrl]);

    const resolveAction = useCallback(
        (action: "shared" | "copied" | "dismissed") => {
            if (hasResolvedRef.current) return;
            hasResolvedRef.current = true;
            currentRequest.emitter({
                result: { action, installUrl: installUrl ?? undefined },
            });
        },
        [currentRequest.emitter, installUrl]
    );

    const handleDismiss = () => {
        resolveAction("dismissed");
        clearRequest();
    };

    const handleShareAgain = () => {
        clearConfirmation();
        hasResolvedRef.current = false;
        setShowConfirmation(false);
    };

    const products = useMemo(
        () => (currentRequest.params.products as SharingPageProduct[]) ?? [],
        [currentRequest.params.products]
    );

    // Product selection state — default to first product
    const [selectedProductIndex, setSelectedProductIndex] = useState(0);

    // Build the final sharing link with Frak context via shared helper.
    // Use the selected product's link if available, otherwise fall back to default.
    const finalSharingLink = useMemo(() => {
        const selectedProduct = products[selectedProductIndex];
        return buildSharingLink({
            clientId: clientId ?? undefined,
            merchantId,
            wallet: walletAddress,
            baseUrl:
                selectedProduct?.link ??
                currentRequest.params.link ??
                sourceUrl,
            attribution: currentRequest.params.attribution,
            defaultAttribution,
            productUtmContent: selectedProduct?.utmContent,
        });
    }, [
        clientId,
        walletAddress,
        merchantId,
        currentRequest.params.link,
        currentRequest.params.attribution,
        sourceUrl,
        products,
        selectedProductIndex,
        defaultAttribution,
    ]);

    // Share mutation using the shared hook (auto-fires `sharing_link_shared`).
    const { mutate: triggerSharing, isPending: isSharing } = useShareLink(
        finalSharingLink,
        {
            title: t("sharing.title"),
            text: t("sharing.text"),
        },
        {
            source: "sharing_page_listener",
            merchantId,
            onShared: () => trackSharing(),
            onSuccess: (result) => {
                if (!result) return;
                toast.success(t("sharing.btn.shareSuccess"));
                resolveAction("shared");
                if (merchantId) saveConfirmation(merchantId);
                setShowConfirmation(true);
            },
        }
    );

    const handleCopy = () => {
        if (!finalSharingLink) return;
        copy(finalSharingLink);
        trackEvent("sharing_link_copied", {
            source: "sharing_page_listener",
            merchant_id: merchantId,
            link: finalSharingLink,
        });
        trackSharing();
        toast.success(t("sharing.btn.copySuccess"));
        resolveAction("copied");
        if (merchantId) saveConfirmation(merchantId);
        setShowConfirmation(true);
    };

    const handleShare = () => {
        if (!finalSharingLink) return;
        triggerSharing();
    };

    const handleInstall = useCallback(() => {
        if (!installUrl) return;
        emitLifecycleEvent(
            {
                iframeLifecycle: "redirect",
                data: {
                    baseRedirectUrl: installUrl,
                    openInNewTab: true,
                },
            },
            { includeUserActivation: true }
        );
    }, [installUrl]);

    return (
        <SharingPage
            appName={currentRequest.appName}
            logoUrl={currentRequest.logoUrl}
            products={products}
            selectedProductIndex={selectedProductIndex}
            onProductSelect={setSelectedProductIndex}
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
            onConfirmationDismiss={clearRequest}
        />
    );
}
