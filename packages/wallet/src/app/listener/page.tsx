"use client";

import { useArticlePrices } from "@/module/paywall/hook/useArticlePrices";
import {
    type EventsFormat, getPricesResponseEvent,
    Listener, parseGetPricesEventData,
    parseGetPricesEventResponse,
} from "@frak-wallet/sdk";
import { useState } from "react";
import type { Hex } from "viem";
import { useEffect } from "react";

export default function ListenerPage() {
    const [contentId, setContentId] = useState<Hex>();
    // const [articleId, setArticleId] = useState<Hex>();
    // The contentId and articleId are from the request params (`parseGetPricesEventData(data)` stuff)
    // Would be better inside a mutation I think
    const { prices } = useArticlePrices({ contentId: "0xDD", articleId: "0x00"});
    console.log(prices);

    const listener = new Listener();

    /**
     * Handle the get-price event response
     * @param data
     */
    async function handleGetPriceRequest(data: EventsFormat) {
        console.log("handleGetPrice", data);
        if (!data) return;
        console.log("===listener page get-price", data);
        const parsed = await parseGetPricesEventData(data);
        console.log("parsed", parsed);

        // TODO: We should trigger a mutation with that data that should send the response I think
        // TODO: Maybe the event key should include '-request' and '-response' for better clarity? Your call
        // Build the response we will send
        if (!prices) {
            console.error("No prices found for param");
            return;
        }
        const reponseEvent = await getPricesResponseEvent(prices)
        listener.emitToProvider(reponseEvent);

        // setContentId(data);
    }

    useEffect(() => {
        listener.emitter.on("get-price", handleGetPriceRequest);

        return () => {
            listener.emitter.off("get-price", handleGetPriceRequest);
        };
    }, [listener.emitter]);

    useEffect(() => {
        if (!prices || prices.length === 0) return;
        // listener.emitToProvider({ topic: "get-price", data: prices });
    }, [prices, listener]);

    return <h1>Listener</h1>;
}
