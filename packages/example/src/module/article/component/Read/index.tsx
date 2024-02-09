import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import type { Article } from "@/type/Article";
import {
    type EventsFormat,
    Provider,
    getPricesEvent,
    parseGetPricesEventResponse,
} from "@frak-wallet/sdk";
import { getUnlockStatusEvent } from "@frak-wallet/sdk/src/events/unlock";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { UnlockButtons } from "@/module/article/component/UnlockButtons";

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
        const parsed = await parseGetPricesEventResponse(data);
        // TODO - we should need to remove the validationHash on higher level
        parsed.validationHash = undefined;
        setPrices(Object.values(parsed).filter(Boolean));
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
                console.log("priceEvent", priceEvent);
                provider.emitToListener(priceEvent);

                const unlockEvent = await getUnlockStatusEvent(
                    frakWalletSdkConfig,
                    {
                        articleId: article.id as Hex,
                    }
                );
                console.log("unlockEvent", unlockEvent);
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
