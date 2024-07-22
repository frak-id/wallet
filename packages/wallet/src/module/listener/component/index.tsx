"use client";

import { createIFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { ListenerModal } from "@/module/listener/component/Modal";
import { useArticleUnlockStatusListener } from "@/module/listener/hooks/useArticleUnlockStatusListener";
import { useDisplayModalListener } from "@/module/listener/hooks/useDisplayModalListener";
import { useGetArticleUnlockOptionsListener } from "@/module/listener/hooks/useGetArticleUnlockOptionsListener";
import { useOnOpenSso } from "@/module/listener/hooks/useOnOpenSso";
import { useSendInteractionListener } from "@/module/listener/hooks/useSendInteractionListener";
import { useWalletStatusListener } from "@/module/listener/hooks/useWalletStatusListener";
import { useEffect, useState } from "react";

/**
 * Global Listener UI that cna only be set via an iFrame
 *  - It's goal is to answer every request from the iFrame windows parent
 * @constructor
 */
export function ListenerUI() {
    const [resolver, setResolver] = useState<
        ReturnType<typeof createIFrameRequestResolver> | undefined
    >(undefined);

    // Hook used when a wallet status is requested
    const onWalletListenRequest = useWalletStatusListener();

    // Hook a website want to fetch the unlock options for an article
    const onGetArticleUnlockOptions = useGetArticleUnlockOptionsListener();

    // Hook to listen for the gating unlock status of an article
    const onArticleUnlockStatusListenerRequest =
        useArticleUnlockStatusListener();

    // Hook used when a dashboard action is requested
    const onInteractionRequest = useSendInteractionListener();

    // Hook when a modal display is asked
    const onDisplayModalRequest = useDisplayModalListener();

    // Hook when a modal display is asked
    const onOpenSso = useOnOpenSso();

    // Create the resolver
    useEffect(() => {
        const newResolver = createIFrameRequestResolver({
            /**
             * Listen request on an article unlock status
             */
            frak_listenToArticleUnlockStatus:
                onArticleUnlockStatusListenerRequest,

            /**
             * Listen request on the wallet status
             */
            frak_listenToWalletStatus: onWalletListenRequest,

            /**
             * Get the unlock options for an article
             * @param request
             * @param emitter
             */
            frak_getArticleUnlockOptions: onGetArticleUnlockOptions,

            /**
             * Listen request for the send interaction request
             */
            frak_sendInteraction: onInteractionRequest,

            /**
             * Listen request for the modal display request
             */
            frak_displayModal: onDisplayModalRequest,

            /**
             * Listen request for the open sso request
             */
            frak_sso: onOpenSso,
        });

        // Set our new resolver
        setResolver(newResolver);

        // On cleanup, destroy the resolver
        return () => {
            newResolver.destroy();
        };
    }, [
        onWalletListenRequest,
        onGetArticleUnlockOptions,
        onArticleUnlockStatusListenerRequest,
        onInteractionRequest,
        onDisplayModalRequest,
        onOpenSso,
    ]);

    /**
     * Once all the required state are set, we can start handling the request
     */
    useEffect(() => {
        if (
            resolver &&
            typeof onWalletListenRequest === "function" &&
            typeof onGetArticleUnlockOptions === "function" &&
            typeof onArticleUnlockStatusListenerRequest === "function"
        ) {
            resolver.setReadyToHandleRequest();
        }
    }, [
        resolver,
        onWalletListenRequest,
        onGetArticleUnlockOptions,
        onArticleUnlockStatusListenerRequest,
    ]);

    /**
     * Add a data attribute to the root element to style the layout
     */
    useEffect(() => {
        const rootElement = document.querySelector(":root") as HTMLElement;
        if (rootElement) {
            rootElement.dataset.listener = "true";
        }

        return () => {
            rootElement.dataset.listener = "false";
        };
    }, []);

    return <ListenerModal />;
}
