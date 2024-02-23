import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { InjectUnlockComponent } from "@/module/article/component/Read/InjectUnlockComponent";
import { Skeleton } from "@/module/common/component/Skeleton";
import type { ArticlePreparedForReading } from "@/type/Article";
import { QueryProvider } from "@frak-wallet/sdk";
import type {
    GetUnlockStatusResponse,
    GetUserStatusResponse,
    UnlockRequestResult,
} from "@frak-wallet/sdk";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import { useEffect, useState } from "react";
import React from "react";
import type { Hex } from "viem";
import styles from "./index.module.css";

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
    article: ArticlePreparedForReading;
    unlockStatusRequest: UnlockRequestResult | undefined;
}) {
    // Init our query provider
    const [queryProvider, setQueryProvider] = useState<
        QueryProvider | undefined
    >(undefined);

    // The injecting state for the unlock component
    const [injecting, setInjecting] = useState(false);

    // The prices
    const [prices, setPrices] = useState<ArticlePriceForUser[]>([]);

    // The unlock status
    const [unlockStatus, setUnlockStatus] = useState<
        GetUnlockStatusResponse | UnlockRequestResult | undefined
    >(unlockStatusRequest);

    // The user status
    const [userStatus, setUserStatus] = useState<
        GetUserStatusResponse | undefined
    >();

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
                    setUserStatus(event);
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

    return (
        <>
            {injecting && (
                <InjectUnlockComponent
                    prices={prices}
                    unlockStatus={unlockStatus}
                    userStatus={userStatus}
                    article={article}
                />
            )}
            {unlockStatus ? (
                <iframe
                    id="frak-article-iframe"
                    title={"frak"}
                    className={styles.readArticle__iframe}
                    srcDoc={`${
                        unlockStatus?.key !== "valid"
                            ? article.rawLockedContent
                            : article.rawUnlockedContent
                    }`}
                    onLoad={() => setInjecting(true)}
                />
            ) : (
                <div style={{ margin: "16px" }}>
                    <Skeleton />
                </div>
            )}
        </>
    );
}
