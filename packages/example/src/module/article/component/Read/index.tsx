import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { UnlockButtons } from "@/module/article/component/UnlockButtons";
import type { Article } from "@/type/Article";
import {
    Provider,
    getPricesEvent,
    getUnlockStatusEvent,
    parseGetPricesEventResponse,
} from "@frak-wallet/sdk";
import type { EventsFormat } from "@frak-wallet/sdk";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hex } from "viem";

const provider = new Provider();

export function ReadArticle({
    article,
}: {
    article: Article;
}) {
    const [prices, setPrices] = useState<ArticlePriceForUser[]>([]);

    /**
     * Handle the get-price event response
     * @param data
     */
    async function handleGetPrice(data: EventsFormat) {
        if (!data) return;
        const responseParsed = await parseGetPricesEventResponse(data);
        setPrices(Object.values(responseParsed.prices).filter(Boolean));
    }

    useEffect(() => {
        provider.emitter.on("get-price", handleGetPrice);

        return () => {
            provider.emitter.off("get-price", handleGetPrice);
        };
    }, []);

    useEffect(() => {
        setTimeout(() => {
            /**
             * Ask our listener for the price of the article
             */
            async function run() {
                const priceEvent = await getPricesEvent(frakWalletSdkConfig, {
                    articleId: article.id as Hex,
                });
                provider.emitToListener(priceEvent);

                const unlockEvent = await getUnlockStatusEvent(
                    frakWalletSdkConfig,
                    {
                        articleId: article.id as Hex,
                    }
                );
                provider.emitToListener(unlockEvent);
            }
            run();
        }, 2000);
    }, [article.id]);

    return (
        <div>
            <h1>Reading Article {article.title}</h1>
            <p>{article.description}</p>

            <button type="button">unlock</button>

            <br />

            <Link href={`${process.env.FRAK_WALLET_URL}/paywall`}>
                Unlock with FRK
            </Link>

            {prices && <UnlockButtons prices={prices} />}
        </div>
    );
}
