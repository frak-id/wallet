import { sanitizeSharingProducts } from "@frak-labs/core-sdk";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared/common";
import {
    buildInstallUrl,
    SharingPage,
    useSharingPageController,
} from "@frak-labs/wallet-shared/sharing";
import { clientIdStore } from "@frak-labs/wallet-shared/stores/clientIdStore";
import { sessionStore } from "@frak-labs/wallet-shared/stores/sessionStore";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { Toaster } from "sonner";
import { useStore } from "zustand";
import { useTrackSharing } from "@/module/hooks/useTrackSharing";
import { useSafeResolvingContext } from "@/module/stores/hooks";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import {
    useListenerTranslation,
    useSharingListenerUI,
} from "@/ui/ListenerUiProvider";

// Re-export the lazy handler body so it lands in the lazy-shared chunk
// (which already hosts both the sharing UI and the impl regex match).
// See useDisplaySharingPageListener.ts.
export { handleDisplaySharingPage } from "@/module/hooks/useDisplaySharingPageListener.impl";

export function ListenerSharingPage() {
    const { currentRequest, clearRequest } = useSharingListenerUI();
    const { t: rawT } = useListenerTranslation();
    const { sourceUrl, merchantId, installProof } = useSafeResolvingContext();
    const defaultAttribution = useStore(
        resolvingContextStore,
        (s) => s.backendSdkConfig?.attribution
    );
    const backendCurrency = useStore(
        resolvingContextStore,
        (s) => s.backendSdkConfig?.currency
    );
    const clientId = useStore(clientIdStore, (s) => s.clientId);
    const walletAddress = useStore(sessionStore, (s) => s.session?.address);
    const { mutate: trackSharing } = useTrackSharing();

    // Sanitized rather than cast: `params.products` is an unvalidated RPC
    // payload whose numeric scope fields now feed campaign selection.
    const products = useMemo(
        () => sanitizeSharingProducts(currentRequest.params.products) ?? [],
        [currentRequest.params.products]
    );

    // Compute the install URL centrally
    const installUrl = useMemo(() => {
        if (!(merchantId && clientId)) return null;
        return buildInstallUrl({
            baseUrl: window.location.origin,
            merchantId,
            clientId,
            installProof,
        });
    }, [merchantId, clientId, installProof]);

    const hasResolvedRef = useRef(false);

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

    const controller = useSharingPageController({
        merchantId,
        clientId: clientId ?? undefined,
        wallet: walletAddress,
        link: currentRequest.params.link ?? sourceUrl,
        products,
        merchant: {
            name: currentRequest.appName,
            logoUrl: currentRequest.logoUrl,
        },
        attribution: currentRequest.params.attribution,
        defaultAttribution,
        // The provider seeds `estimatedReward` from its own product-agnostic
        // query. This page ranks against the selected product, so it runs its
        // own — react-query dedupes it against the provider's when the keys
        // match, so this costs no extra request.
        rewardQuery: {
            currency:
                currentRequest.configMetadata?.currency ?? backendCurrency,
            targetInteraction: currentRequest.targetInteraction,
            context: currentRequest.i18n?.context,
        },
        source: "sharing_page_listener",
        installUrl,
        // The listener draws the page inside its own iframe overlay, which is
        // this page's own chrome — not a host's.
        chrome: { mode: "full" },
        t: rawT,
        outcomes: {
            dismiss: () => {
                resolveAction("dismissed");
                clearRequest();
            },
            shareAgain: () => {
                // The RPC may be resolved again after a second share.
                hasResolvedRef.current = false;
            },
            install: () => {
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
            },
            confirmationDismiss: clearRequest,
            onConfirmed: resolveAction,
            recordSharing: () => trackSharing(),
        },
    });

    // If we restore from sessionStorage, still resolve the RPC as "shared" so
    // the SDK consumer gets a result — the controller only reports outcomes it
    // saw happen, and a restored confirmation happened on a previous mount.
    useEffect(() => {
        if (controller.view === "confirmation") resolveAction("shared");
    }, [controller.view, resolveAction]);

    return (
        <>
            {/* Owned by the consumer, not by `SharingPage`: the embedded
                wallet mounts its own, and a shared presentational component
                should not decide that a global overlay exists. */}
            <Toaster position="top-center" />
            <SharingPage {...controller} />
        </>
    );
}
