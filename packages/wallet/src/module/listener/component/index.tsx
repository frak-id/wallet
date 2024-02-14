"use client";

import { useArticlePrices } from "@/module/paywall/hook/useArticlePrices";
import { useUnlockState } from "@/module/paywall/hook/useUnlockState";
import { type GetUnlockStatusResponse, QueryListener } from "@frak-wallet/sdk";
import { useEffect, useState } from "react";
import type { Hex } from "viem";

type UnlockStateListenerParam = {
    contentId: Hex;
    articleId: Hex;
    emitter: (response: GetUnlockStatusResponse) => Promise<void>;
};

const queryListener = new QueryListener();

export function ListenerUI() {
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

    // Bind the fetch price hook
    useEffect(() => {
        if (!fetchPrices) {
            return;
        }

        queryListener.onPriceRequested = fetchPrices;
        queryListener.onStatusRequested = async (param, emitter) => {
            setUnlockStatusParam({
                contentId: param.contentId,
                articleId: param.articleId,
                emitter,
            });
        };

        // Tell that the listener is rdy to handle data
        queryListener.setReadyToHandleRequest();

        // Cleanup the listener on destroy
        return () => {
            queryListener.onPriceRequested = async (_) => {
                return undefined;
            };
            queryListener.onStatusRequested = async () => {};
        };
    }, [fetchPrices]);

    // Every time the unlock state change, send it to the listener
    useEffect(() => {
        if (unlockState) {
            unlockStatusParam?.emitter(unlockState);
        }
    }, [unlockState, unlockStatusParam]);

    return <h1>Listener</h1>;
}
