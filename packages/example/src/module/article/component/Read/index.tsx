import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { UnlockButtons } from "@/module/article/component/UnlockButtons";
import type { Article } from "@/type/Article";
import { QueryProvider } from "@frak-wallet/sdk";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Hex } from "viem";

export function ReadArticle({
    article,
}: {
    article: Article;
}) {
    // Init our query provider
    const [queryProvider, setQueryProvider] = useState<
        QueryProvider | undefined
    >(undefined);
    useEffect(() => {
        // If we already got a query provider, do nothing
        if (queryProvider) {
            return;
        }

        // Otherwise, build it
        initQueryProvider();
    }, [queryProvider]);

    // Build the query provider
    async function initQueryProvider() {
        const iframe = await QueryProvider.createIframe({
            walletBaseUrl: frakWalletSdkConfig.walletUrl,
        });
        const queryProvider = new QueryProvider({
            config: frakWalletSdkConfig,
            iframe,
        });
        setQueryProvider(queryProvider);
    }

    // The price we will use
    const [prices, setPrices] = useState<ArticlePriceForUser[]>([]);

    useEffect(() => {
        // If we don't have a query provider, do nothing
        if (!queryProvider) {
            return;
        }

        setTimeout(() => {
            /**
             * Ask our listener for the price of the article
             */
            async function run() {
                const getPricesResponse = await queryProvider.oneShotRequest({
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
    }, [article.id, queryProvider]);

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
