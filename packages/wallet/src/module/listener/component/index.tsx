"use client";

import { createIFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { useArticleUnlockStatusListener } from "@/module/listener/hooks/useArticleUnlockStatusListener";
import { useGetArticleUnlockOptionsListener } from "@/module/listener/hooks/useGetArticleUnlockOptionsListener";
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
    const { onWalletListenRequest } = useWalletStatusListener();

    // Hook used when a wallet status is requested
    const { onGetArticleUnlockOptions } = useGetArticleUnlockOptionsListener();

    // Hook used when a wallet status is requested
    const { onArticleUnlockStatusListenerRequest } =
        useArticleUnlockStatusListener();

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

    return <h1>Listener</h1>;
}
