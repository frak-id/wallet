"use client";

import { createIFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { useWalletListenerHook } from "@/module/listener/hooks/useWalletListenerHook";
import { useArticlePrices } from "@/module/paywall/hook/useArticlePrices";
import { useUnlockState } from "@/module/paywall/hook/useUnlockState";
import type { ArticleUnlockStatusReturnType } from "@frak-labs/nexus-sdk/core";
import { useEffect, useState } from "react";
import type { Hex } from "viem";

type UnlockStateListenerParam = {
    contentId: Hex;
    articleId: Hex;
    emitter: (response: ArticleUnlockStatusReturnType) => Promise<void>;
};

export function ListenerUI() {
    const [resolver, setResolver] = useState<
        ReturnType<typeof createIFrameRequestResolver> | undefined
    >(undefined);

    // Hook used when a wallet status is requested
    const { onWalletListenRequest } = useWalletListenerHook();

    // Hook used to fetch the prices
    const { fetchPrices } = useArticlePrices();

    // Info required to fetch the unlock status
    const [unlockStatusParam, setUnlockStatusParam] = useState<
        UnlockStateListenerParam | undefined
    >(undefined);
    const { unlockState } = useUnlockState({
        contentId: unlockStatusParam?.contentId,
        articleId: unlockStatusParam?.articleId,
    });

    // Create the resolver
    useEffect(() => {
        const newResolver = createIFrameRequestResolver({
            /**
             * Listen request on an article unlock status
             */
            frak_listenToArticleUnlockStatus: async (request, emitter) => {
                // Register our unlock status listener
                setUnlockStatusParam({
                    contentId: request.params[0],
                    articleId: request.params[1],
                    emitter,
                });
            },

            /**
             * Listen request on the wallet status
             */
            frak_listenToWalletStatus: onWalletListenRequest,

            /**
             * Get the unlock options for an article
             * @param request
             * @param emitter
             */
            frak_getArticleUnlockOptions: async (request, emitter) => {
                // Directly fetch the price here
                const prices = await fetchPrices({
                    contentId: request.params[0],
                    articleId: request.params[1],
                });
                // And send the response
                await emitter(prices);
            },
        });

        // Set our new resolver
        setResolver(newResolver);

        // On cleanup, destroy the resolver
        return () => {
            newResolver.destroy();
        };
    }, [fetchPrices, onWalletListenRequest]);

    /**
     * Once all the required state are set, we can start handling the request
     */
    useEffect(() => {
        if (resolver && typeof fetchPrices === "function") {
            resolver.setReadyToHandleRequest();
        }
    }, [resolver, fetchPrices]);

    /**
     * Every time the unlock state change, send it to the listener
     */
    useEffect(() => {
        if (unlockState) {
            console.log("Sending the unlock state to the listener", {
                unlockState,
            });
            unlockStatusParam?.emitter(unlockState);
        }
    }, [unlockState, unlockStatusParam]);

    return <h1>Listener</h1>;
}
