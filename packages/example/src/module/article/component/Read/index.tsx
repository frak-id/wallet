import { InjectBannerComponent } from "@/module/article/component/Read/InjectBannerComponent";
import { InjectReferralPopupComponent } from "@/module/article/component/Read/InjectReferralPopupComponent";
import { InjectUnlockComponent } from "@/module/article/component/Read/InjectUnlockComponent";
import { Skeleton } from "@/module/common/component/Skeleton";
import { fixLink } from "@/module/common/utils/link";
import type { Article } from "@/type/Article";
import {
    useArticleUnlockOptions,
    useArticleUnlockStatus,
    usePressReferralInteraction,
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
    // The press referral interaction hook
    const referralState = usePressReferralInteraction({
        contentId: article.contentId as Hex,
    });

    // The injecting state for the unlock component
    const [injecting, setInjecting] = useState(0);

    // The iframe reference
    const [iframeRef, setIframeRef] = useState<HTMLIFrameElement | null>(null);

    // The unlock options for the article
    const { data: unlockOptions } = useArticleUnlockOptions({
        articleId: article.id as Hex,
        contentId: article.contentId as Hex,
    });

    // The unlock status
    const { data: articleUnlockStatus } = useArticleUnlockStatus({
        articleId: article.id as Hex,
        contentId: article.contentId as Hex,
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
                    balanceHex={unlockOptions?.frkBalanceAsHex}
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
            {injecting > 0 && (
                <InjectReferralPopupComponent
                    article={article}
                    referralState={referralState}
                />
            )}
            {articleUnlockStatus &&
            articleUnlockStatus?.key !== "waiting-response" ? (
                <iframe
                    ref={setIframeRef}
                    id="frak-article-iframe"
                    title={"frak"}
                    className={styles.readArticle__iframe}
                    src={`${fixLink(lockedOrUnlocked())}`}
                />
            ) : (
                <div style={{ margin: "16px" }}>
                    <Skeleton />
                </div>
            )}
        </>
    );
}
