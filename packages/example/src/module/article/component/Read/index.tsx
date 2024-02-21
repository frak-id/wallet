import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { UnlockButtons } from "@/module/article/component/UnlockButtons";
import { RootProvider } from "@/module/common/provider/RootProvider";
import type { Article } from "@/type/Article";
import { QueryProvider } from "@frak-wallet/sdk";
import type {
    GetUnlockStatusResponse,
    UnlockRequestResult,
} from "@frak-wallet/sdk";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";
import React from "react";
import { createRoot } from "react-dom/client";
import type { Hex } from "viem";
import { ArticleContent } from "../ArticleContent";

function injectUnlockComponent() {
    const containerName = "frak-paywall";
    let containerRoot = document.getElementById(containerName);
    if (!containerRoot) {
        const appRoot = document.createElement("div");
        appRoot.id = containerName;
        const element = document.querySelector(".lmd-paywall");
        element?.insertAdjacentElement("afterbegin", appRoot);
        containerRoot = document.getElementById(containerName);
    }

    if (!containerRoot) {
        console.log("Element frak-paywall not found");
        return;
    }

    const root = createRoot(containerRoot);
    root.render(
        <React.StrictMode>
            <RootProvider>
                <UnlockButtons />
            </RootProvider>
        </React.StrictMode>
    );
}

async function loadArticle({ url }: { url: string }) {
    const fetching = await fetch(
        process.env.IS_LOCAL === "true"
            ? url.replace("https://news-example.frak.id/", "/")
            : url
    );
    return await fetching.text();
}

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
    return new QueryProvider({
        config: frakWalletSdkConfig,
        iframe,
    });
}

export function ReadArticle({
    article,
    unlockStatusRequest,
}: {
    article: Article;
    unlockStatusRequest: UnlockRequestResult | undefined;
}) {
    // Init our query provider
    const [queryProvider, setQueryProvider] = useState<
        QueryProvider | undefined
    >(undefined);

    // The article html data
    const [data, setData] = useState<string | undefined>();

    // The price, shared with unlock component
    const [, setPrices] = useLocalStorage<ArticlePriceForUser[]>("prices", []);

    // The unlock status, shared with unlock component
    const [unlockStatus, setUnlockStatus] = useLocalStorage<
        GetUnlockStatusResponse | UnlockRequestResult | undefined
    >("unlockStatus", unlockStatusRequest);

    // The article, shared with unlock component
    useLocalStorage<Article | null>("article", article);

    useEffect(() => {
        // Build the query provider
        initQueryProvider().then((queryProvider) => {
            if (!queryProvider) return;
            setQueryProvider(queryProvider);
        });

        // On cleanup, destroy the query provider
        return () => {
            queryProvider?.destroy();
        };
    }, [queryProvider?.destroy]);

    // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
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

        const fetchUnlockStatus = async () => {
            const unlockStatus = await queryProvider.listenerRequest({
                param: {
                    key: "unlock-status-param",
                    value: {
                        contentId: frakWalletSdkConfig.contentId,
                        articleId: article.id as Hex,
                    },
                },
                onResponse: async (event) => {
                    setUnlockStatus(event);
                },
            });
            console.log("Unlock status listener ID", { unlockStatus });
            // TODO: The listener id should be used to remove the listener on destroy
        };

        const fetchUserStatus = async () => {
            const unlockStatus = await queryProvider.listenerRequest({
                param: {
                    key: "user-status-param",
                    value: undefined,
                },
                onResponse: async (event) => {
                    console.log("User status response event", event);
                },
            });
            console.log("User status listener ID", { unlockStatus });
            // TODO: The listener id should be used to remove the listener on destroy
        };

        // Setup fetcher once listener linked
        queryProvider.waitForListenerLink().then(() => {
            console.log("Query listener linked");
            fetchPrices();
            fetchUnlockStatus();
            fetchUserStatus();
        });
    }, [article.id, queryProvider]);

    // Load the article content
    useEffect(() => {
        if (!(article.lockedContentUrl && unlockStatus)) {
            return;
        }
        const isLocked = unlockStatus?.status !== "unlocked";
        loadArticle({
            url: isLocked
                ? article.lockedContentUrl
                : article.unlockedContentUrl,
        }).then((data) => {
            setData(data);
            !isLocked && window.scrollTo(0, 0);
        });
    }, [article.lockedContentUrl, article.unlockedContentUrl, unlockStatus]);

    // Inject the unlock component into article html
    useEffect(() => {
        if (!data) return;
        injectUnlockComponent();
    }, [data]);

    return <ArticleContent data={data} />;
}
