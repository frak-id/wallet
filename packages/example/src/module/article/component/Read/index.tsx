import { InjectBannerComponent } from "@/module/article/component/Read/InjectBannerComponent";
import { InjectUnlockComponent } from "@/module/article/component/Read/InjectUnlockComponent";
import { Skeleton } from "@/module/common/component/Skeleton";
import type { ArticlePreparedForReading } from "@/type/Article";
import {
    useArticleUnlockOptions,
    useArticleUnlockStatus,
    useWalletStatus,
} from "@frak-labs/nexus-sdk/react";
import { useState } from "react";
import React from "react";
import type { Hex } from "viem";
import styles from "./index.module.css";

export function ReadArticle({
    article,
    isFree,
}: {
    article: ArticlePreparedForReading;
    isFree: boolean;
}) {
    // The injecting state for the unlock component
    const [injecting, setInjecting] = useState(false);

    // The unlock options for the article
    const { data: unlockOptions } = useArticleUnlockOptions({
        articleId: article.id as Hex,
    });

    // The unlock status
    const { data: articleUnlockStatus } = useArticleUnlockStatus({
        articleId: article.id as Hex,
    });

    // The user status
    const { data: walletStatus } = useWalletStatus();

    function lockedOrUnlocked() {
        if (isFree) {
            return article.rawUnlockedContent;
        }
        return articleUnlockStatus?.status !== "unlocked"
            ? article.rawLockedContent
            : article.rawUnlockedContent;
    }

    return (
        <>
            {injecting && !isFree && (
                <InjectUnlockComponent
                    prices={unlockOptions?.prices ?? []}
                    unlockStatus={articleUnlockStatus}
                    walletStatus={walletStatus}
                    article={article}
                />
            )}
            {injecting && isFree && walletStatus?.key === "not-connected" && (
                <InjectBannerComponent article={article} />
            )}
            {articleUnlockStatus ? (
                <iframe
                    id="frak-article-iframe"
                    title={"frak"}
                    className={styles.readArticle__iframe}
                    srcDoc={`${lockedOrUnlocked()}`}
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
