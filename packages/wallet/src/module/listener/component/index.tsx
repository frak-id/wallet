"use client";

import { useArticlePrices } from "@/module/paywall/hook/useArticlePrices";
import { QueryListener } from "@frak-wallet/sdk";
import { useEffect } from "react";

const listener = new QueryListener();

export function ListenerUI() {
    const { fetchPrices } = useArticlePrices();
    useEffect(() => {
        if (!fetchPrices) {
            return;
        }

        listener.onPriceRequested = fetchPrices;
    }, [fetchPrices]);

    // TODO: Similar logic for  the unlock status

    return <h1>Listener</h1>;
}
