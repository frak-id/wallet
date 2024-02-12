"use client";

import { useArticlePrices } from "@/module/paywall/hook/useArticlePrices";
import { Listener } from "@frak-wallet/sdk";

const listener = new Listener();

export function ListenerUI() {
    const { fetchPrices } = useArticlePrices();
    listener.setPriceFetcher(fetchPrices);

    return <h1>Listener</h1>;
}
