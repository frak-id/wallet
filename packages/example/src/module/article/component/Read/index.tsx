import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { InjectUnlockComponent } from "@/module/article/component/Read/InjectUnlockComponent";
import { Skeleton } from "@/module/common/component/Skeleton";
import type { ArticlePreparedForReading } from "@/type/Article";
import {
    getArticleUnlockOptions,
    watchUnlockStatus,
    watchWalletStatus,
} from "@frak-wallet/sdk/actions";
import {
    type ArticleUnlockStatusReturnType,
    type WalletStatusReturnType,
    createIFrameFrakClient,
    createIframe,
} from "@frak-wallet/sdk/core";
import type { FrakClient } from "@frak-wallet/sdk/core";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import { useEffect, useState } from "react";
import React from "react";
import type { Hex } from "viem";
import styles from "./index.module.css";

async function initFrakTransport() {
    // Create the iframe
    const iframe = await createIframe({
        walletBaseUrl: frakWalletSdkConfig.walletUrl,
    });

    // If we don't have an iframe, do nothing
    if (!iframe) {
        return;
    }

    // Create the query provider
    return createIFrameFrakClient({
        config: frakWalletSdkConfig,
        iframe,
    });
}

export function ReadArticle({
    article,
    //unlockStatusRequest,
}: {
    article: ArticlePreparedForReading;
    //unlockStatusRequest: UnlockRequestResult | undefined;
}) {
    // Init our query provider
    const [iframeFrakClient, setIframeFrakClient] = useState<
        FrakClient | undefined
    >(undefined);

    // The injecting state for the unlock component
    const [injecting, setInjecting] = useState(false);

    // The prices
    const [prices, setPrices] = useState<ArticlePriceForUser[]>([]);

    // The unlock status
    const [unlockStatus, setUnlockStatus] = useState<
        ArticleUnlockStatusReturnType | undefined
    >(undefined);

    // The user status
    const [walletStatus, setWalletStatus] = useState<
        WalletStatusReturnType | undefined
    >();

    useEffect(() => {
        // Build the query provider
        initFrakTransport().then((client) => {
            if (!client) return;
            setIframeFrakClient(client);
        });

        // On cleanup, destroy the query provider
        return () => {
            iframeFrakClient?.destroy();
        };
    }, [iframeFrakClient?.destroy]);

    useEffect(() => {
        // If we don't have a query provider, do nothing
        if (!iframeFrakClient) {
            return;
        }

        const fetchPrices = async () => {
            const unlockOptionsResponses = await getArticleUnlockOptions(
                iframeFrakClient,
                {
                    articleId: article.id as Hex,
                }
            );
            setPrices(unlockOptionsResponses.prices);
        };

        const fetchUnlockStatus = async () =>
            watchUnlockStatus(
                iframeFrakClient,
                {
                    articleId: article.id as Hex,
                },
                (event) => {
                    console.log("Unlock status response event", { event });
                    setUnlockStatus(event);
                }
            );

        const fetchUserStatus = async () =>
            watchWalletStatus(iframeFrakClient, (event) => {
                console.log("Wallet status response event", { event });
                setWalletStatus(event);
            });

        // Setup fetcher once listener linked
        iframeFrakClient.waitForConnection.then(() => {
            console.log("IFrame frak client linked");
            fetchPrices();
            fetchUnlockStatus();
            fetchUserStatus();
        });
    }, [article.id, iframeFrakClient]);

    return (
        <>
            {injecting && (
                <InjectUnlockComponent
                    prices={prices}
                    unlockStatus={unlockStatus}
                    walletStatus={walletStatus}
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
