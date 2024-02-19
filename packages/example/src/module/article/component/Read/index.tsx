import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { UnlockButtons } from "@/module/article/component/UnlockButtons";
import type { Article } from "@/type/Article";
import { QueryProvider } from "@frak-wallet/sdk";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
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
        // Otherwise, build it
        initQueryProvider();

        // On cleanup, destroy the query provider
        return () => {
            queryProvider?.destroy();
        };
    }, [queryProvider]);

    // Build the query provider
    async function initQueryProvider() {
        // Create the iframe
        const iframe = await QueryProvider.createIframe({
            walletBaseUrl: frakWalletSdkConfig.walletUrl,
        });

        // If we don't have an iframe, do nothing
        if (!iframe) {
            return;
        }

        // Create the query provider
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

        const fetchPrices = async () => {
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
        };

        const fetchStatus = async () => {
            const unlockStatus = await queryProvider.listenerRequest({
                param: {
                    key: "unlock-status-param",
                    value: {
                        contentId: frakWalletSdkConfig.contentId,
                        articleId: article.id as Hex,
                    },
                },
                onResponse: async (event) => {
                    console.log("Unlock status response event", event);
                },
            });
            console.log("unlockStatus", unlockStatus);
        };

        // Setup fetcher once listener linked
        console.log("Waiting for listener link");
        queryProvider.waitForListenerLink().then(() => {
            console.log("Listener linked");
            fetchPrices();
            fetchStatus();
        });
    }, [article.id, queryProvider]);

    return (
        <div>
            <h1>Reading Article {article.title}</h1>
            <p>{article.description}</p>

            <br />
            <br />

            {prices && <UnlockButtons prices={prices} article={article} />}
        </div>
    );
}
