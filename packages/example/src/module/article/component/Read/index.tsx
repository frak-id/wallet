import { type EventsFormat, getPricesEvent, Provider } from "@frak-wallet/sdk";
import type { Article } from "@/type/Article";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";

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
    function handleGetPrice(data: EventsFormat) {
        if (!data) return;
        console.log("===read page get-price", data);
        // setPrices(data);
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
                const priceEvent = await getPricesEvent(
                    {
                        config: {
                            walletUrl: process.env.FRAK_WALLET_URL,
                            contentId: article.contentId as Hex,
                            contentTitle: article.title,
                        },
                    },
                    { articleId: article.id as Hex }
                );
                console.log("priceEvent", priceEvent);
                provider.emitToListener(priceEvent);
            }
            run();
        }, 2000);
    }, [article.contentId, article.title, article.id]);

    return (
        <div>
            <h1>Reading Article {article.title}</h1>
            <p>{article.description}</p>

            <button type="button">unlock</button>

            <br />

            <Link href={`${process.env.FRAK_WALLET_URL}/paywall`}>
                Unlock with FRK
            </Link>

            {prices.map((price) => (
                <div key={`index-${price.index}`}>
                    <button type={"button"} disabled={!price.isPriceEnabled}>
                        Unlock for {price.frkAmount} FRK
                    </button>
                </div>
            ))}
        </div>
    );
}
