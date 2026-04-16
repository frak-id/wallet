import {
    FrakContextManager,
    type SharingPageProduct,
} from "@frak-labs/core-sdk";
import {
    clearConfirmation,
    clientIdStore,
    emitLifecycleEvent,
    getSavedConfirmation,
    SharingPage,
    saveConfirmation,
    trackGenericEvent,
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

export function ListenerSharingPage() {
    const { currentRequest, clearRequest } = useSharingListenerUI();
    const { t } = useListenerTranslation();
    const { sourceUrl, merchantId } = useSafeResolvingContext();
    const clientId = clientIdStore((s) => s.clientId);
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

    // Build the final sharing link with Frak context
    // Use the selected product's link if available, otherwise fall back to default
    const finalSharingLink = useMemo(() => {
        if (!(clientId && merchantId)) return null;

        const selectedProduct = products[selectedProductIndex];
        const baseLink =
            selectedProduct?.link ?? currentRequest.params.link ?? sourceUrl;

        const attribution = currentRequest.params.attribution;
        const resolvedAttribution =
            attribution === null
                ? undefined
                : {
                      ...(attribution ?? {}),
                      utmContent:
                          selectedProduct?.utmContent ??
                          attribution?.utmContent,
                  };

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
        currentRequest.params.link,
        currentRequest.params.attribution,
        sourceUrl,
        products,
        selectedProductIndex,
    ]);

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
                trackSharing();
                resolveAction("shared");
                if (merchantId) saveConfirmation(merchantId);
                setShowConfirmation(true);
            },
        }
    );

    const handleCopy = () => {
        if (!finalSharingLink) return;
        copy(finalSharingLink);
        trackGenericEvent("sharing-copy-link", {
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
