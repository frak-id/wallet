"use client";

import { useArticlePrices } from "@/module/paywall/hook/useArticlePrices";
import {
    type EventsFormat,
    Listener,
    getPricesResponseEvent,
    parseGetPricesEventData,
} from "@frak-wallet/sdk";
import { useEffect, useState } from "react";
import type { Hex } from "viem";

const listener = new Listener();

export function ListenerCompo() {
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

    useEffect(() => {
        listener.emitter.on("get-price", handleGetPriceRequest);

        return () => {
            listener.emitter.off("get-price", handleGetPriceRequest);
        };
    }, []);

    return <h1>Listener</h1>;
}
