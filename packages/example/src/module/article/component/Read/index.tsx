import { UnlockButtons } from "@/module/article/component/UnlockButtons";
import type { Article } from "@/type/Article";
import { Provider } from "@frak-wallet/sdk";
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

    useEffect(() => {
        setTimeout(() => {
            /**
             * Ask our listener for the price of the article
             */
            async function run() {
                const getPricesResponse = await provider.getPrices({
                    articleId: article.id as Hex,
                });
                setPrices(getPricesResponse.prices);
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
