"use client";

import { useArticlePrices } from "@/module/paywall/hook/useArticlePrices";
import {
    type EventsFormat,
    Listener,
    parseGetPricesEventResponse,
} from "@frak-wallet/sdk";
import { useState } from "react";
import type { Hex } from "viem";
import { useEffect } from "react";

export default function ListenerPage() {
    const [contentId, setContentId] = useState<Hex>();
    // const [articleId, setArticleId] = useState<Hex>();
    const { prices } = useArticlePrices({ contentId });
    console.log(prices);

    const listener = new Listener();

    /**
     * Handle the get-price event response
     * @param data
     */
    async function handleGetPrice(data: EventsFormat) {
        console.log("handleGetPrice", data);
        if (!data) return;
        console.log("===listener page get-price", data);
        const parsed = await parseGetPricesEventResponse(data);
        console.log("parsed", parsed);
        // setContentId(data);
    }

    useEffect(() => {
        listener.emitter.on("get-price", handleGetPrice);

        return () => {
            listener.emitter.off("get-price", handleGetPrice);
        };
    }, [listener.emitter]);

    useEffect(() => {
        if (!prices || prices.length === 0) return;
        // listener.emitToProvider({ topic: "get-price", data: prices });
    }, [prices, listener]);

    return <h1>Listener</h1>;
}
