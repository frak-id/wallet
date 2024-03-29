import { InjectBannerComponent } from "@/module/article/component/Read/InjectBannerComponent";
import { InjectUnlockComponent } from "@/module/article/component/Read/InjectUnlockComponent";
import { Skeleton } from "@/module/common/component/Skeleton";
import type { Article } from "@/type/Article";
import {
    useArticleUnlockOptions,
    useArticleUnlockStatus,
    useWalletStatus,
} from "@frak-labs/nexus-sdk/react";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import styles from "./index.module.css";

export function ReadArticle({
    article,
    isFree,
}: {
    article: Article;
    isFree: boolean;
}) {
    // The injecting state for the unlock component
    const [injecting, setInjecting] = useState(0);

    // The iframe reference
    const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null);

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
            return article.unlockedContentUrl;
        }
        return articleUnlockStatus?.status !== "unlocked"
            ? article.lockedContentUrl
            : article.unlockedContentUrl;
    }

    useEffect(() => {
        if (!iframeRef) return;
        iframeRef.contentWindow?.addEventListener("DOMContentLoaded", () => {
            setInjecting((prev) => prev + 1);
        });
    }, [iframeRef]);

    return (
        <>
            {injecting > 0 && !isFree && (
                <InjectUnlockComponent
                    prices={unlockOptions?.prices ?? []}
                    unlockStatus={articleUnlockStatus}
                    walletStatus={walletStatus}
                    article={article}
                />
            )}
            {injecting > 0 &&
                isFree &&
                walletStatus?.key === "not-connected" && (
                    <InjectBannerComponent article={article} />
                )}
            {articleUnlockStatus &&
            articleUnlockStatus?.key !== "waiting-response" ? (
                <iframe
                    ref={setIframeRef}
                    id="frak-article-iframe"
                    title={"frak"}
                    className={styles.readArticle__iframe}
                    src={`${lockedOrUnlocked()}`}
                />
            ) : (
                <div style={{ margin: "16px" }}>
                    <Skeleton />
                </div>
            )}
        </>
    );
}
