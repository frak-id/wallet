import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { UnlockButtons } from "@/module/article/component/UnlockButtons";
import type { Article } from "@/type/Article";
import { QueryProvider } from "@frak-wallet/sdk/src/services/QueryProvider";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hex } from "viem";

const provider = new QueryProvider({
    config: frakWalletSdkConfig,
    iframe: document.createElement("iframe"),
});

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
                const getPricesResponse = await provider.oneShotRequest({
                    param: {
                        key: "get-price-param",
                        value: {
                            contentId: frakWalletSdkConfig.contentId,
                            articleId: article.id as Hex,
                        },
                    },
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
