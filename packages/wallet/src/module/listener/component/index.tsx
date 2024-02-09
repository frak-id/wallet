"use client";

import { useArticlePrices } from "@/module/paywall/hook/useArticlePrices";
import {
    Listener,
    getPricesResponseEvent,
    parseGetPricesEventData,
} from "@frak-wallet/sdk";
import type { EventsFormat } from "@frak-wallet/sdk";
import { parseUnlockStatusEventData } from "@frak-wallet/sdk/src/events/unlock";
import { useEffect, useState } from "react";
import type { Hex } from "viem";

const listener = new Listener();

export function ListenerUI() {
    const [contentId, setContentId] = useState<Hex>();
    const [articleId, setArticleId] = useState<Hex>();
    const { fetchPrices } = useArticlePrices({
        contentId,
        articleId,
    });

    /**
     * Handle the get-price event response
     * @param data
     */
    async function handleGetPriceRequest(data: EventsFormat) {
        if (!data) return;
        const { articleId, contentId } = await parseGetPricesEventData(data);

        setContentId(contentId);
        setArticleId(articleId);

        const prices = await fetchPrices({ contentId, articleId });
        if (!prices) {
            console.error("No prices found for param");
            return;
        }

        const responseEvent = await getPricesResponseEvent(prices);
        listener.emitToProvider(responseEvent);
    }

    /**
     * Handle the unlock-status event response
     * @param data
     */
    async function handleUnlockRequest(data: EventsFormat) {
        if (!data) return;
        console.log("handleUnlockRequest", data);
        const { articleId, contentId } = await parseUnlockStatusEventData(data);
        console.log("handleUnlockRequest", articleId, contentId);
    }

    useEffect(() => {
        listener.emitter.on("get-price", handleGetPriceRequest);
        listener.emitter.on("unlock-status", handleUnlockRequest);

        return () => {
            listener.emitter.off("get-price", handleGetPriceRequest);
            listener.emitter.off("unlock-status", handleUnlockRequest);
        };
    }, []);

    return <h1>Listener</h1>;
}
