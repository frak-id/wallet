import { sanitizeSharingProducts } from "@frak-labs/core-sdk";
import { emitLifecycleEvent } from "@frak-labs/wallet-shared/common";
import {
    buildInstallUrl,
    SharingPage,
    useSharingIdentity,
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

// Re-exported so the lazy handler body lands in the lazy-shared chunk.
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
    const sdkClientId = useStore(clientIdStore, (s) => s.clientId);
    const walletAddress = useStore(sessionStore, (s) => s.session?.address);
    const { mutate: trackSharing } = useTrackSharing();

    // Sanitized rather than cast: `params.products` is an unvalidated RPC payload.
    const products = useMemo(
        () => sanitizeSharingProducts(currentRequest.params.products) ?? [],
        [currentRequest.params.products]
    );

    // Same reason as `products`: an unvalidated RPC payload, typed but not
    // checked, and it ends up in a URL.
    const checkoutToken =
        typeof currentRequest.params.checkoutToken === "string"
            ? currentRequest.params.checkoutToken
            : undefined;

    // Falls back to the order when the SDK holds no id — a cleared or
    // ad-blocked localStorage would otherwise leave the share link
    // unattributed. `embedded: false` because no host supplies an identity
    // here; the hook reads `clientIdStore` itself.
    const clientId = useSharingIdentity({
        merchantId,
        checkoutToken,
        embedded: false,
    });

    // An `a=` without a proof is refused by `install-code/generate`, so it is
    // worth less than the token: only a proven id may travel, and the two are
    // never sent together.
    const installUrl = useMemo(() => {
        if (!merchantId) return null;
        return buildInstallUrl({
            baseUrl: window.location.origin,
            merchantId,
            ...(sdkClientId && installProof
                ? { clientId: sdkClientId, installProof }
                : { checkoutToken }),
        });
    }, [merchantId, sdkClientId, installProof, checkoutToken]);

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
        clientId,
        wallet: walletAddress,
        link: currentRequest.params.link ?? sourceUrl,
        products,
        merchant: {
            name: currentRequest.appName,
            logoUrl: currentRequest.logoUrl,
        },
        attribution: currentRequest.params.attribution,
        defaultAttribution,
        // Ranked against the selected product, unlike the provider's
        // product-agnostic query; react-query dedupes when the keys match.
        rewardQuery: {
            currency:
                currentRequest.configMetadata?.currency ?? backendCurrency,
            targetInteraction: currentRequest.targetInteraction,
            context: currentRequest.i18n?.context,
        },
        source: "sharing_page_listener",
        installUrl,
        // The listener's own iframe overlay is this page's chrome, not a host's.
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

    // A restored confirmation happened on a previous mount, and the controller
    // only reports outcomes it saw, so resolve the RPC here.
    useEffect(() => {
        if (controller.view === "confirmation") resolveAction("shared");
    }, [controller.view, resolveAction]);

    return (
        <>
            {/* Owned by the consumer: a shared presentational component should not decide that a global overlay exists. */}
            <Toaster position="top-center" />
            <SharingPage {...controller} />
        </>
    );
}
