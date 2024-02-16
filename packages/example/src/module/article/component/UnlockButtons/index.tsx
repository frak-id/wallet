import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { ButtonUnlockArticle } from "@/module/article/component/ButtonUnlockArticle";
import { Button } from "@/module/common/component/Button";
import type { Article } from "@/type/Article";
import { getUnlockRequestUrl } from "@frak-wallet/sdk";
import type { ArticlePrice } from "@frak-wallet/sdk/src/types/ArticlePrice";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import styles from "./index.module.css";

export function UnlockButtons({
    prices,
    article,
}: { prices: ArticlePrice[]; article: Article }) {
    const [step, setStep] = useState(1);
    const [articlePrice, setArticlePrice] = useState<ArticlePrice | null>(null);
    /*const { unlockStatus, errorMessage, unlock } = useUnlockArticleHook({
        articlePrice,
    });*/
    const { data: unlockUrl } = useQuery({
        queryKey: [
            "getEncodedUnlockData",
            article.id,
            articlePrice?.index ?? 0,
        ],
        queryFn: async () => {
            if (!articlePrice) return;

            return getUnlockRequestUrl(frakWalletSdkConfig, {
                articleId: article.id as Hex,
                articleTitle: article.title,
                price: {
                    index: articlePrice.index,
                    unlockDurationInSec: articlePrice.unlockDurationInSec,
                    frkAmount: articlePrice.frkAmount,
                },
                articleUrl: `${window.location.origin}/article?id=${article.id}`,
                redirectUrl: `${window.location.origin}/article?id=${article.id}`,
            });
        },
        enabled: !!articlePrice,
    });

    useEffect(() => {
        if (!articlePrice) return;
        async function run() {
            setStep(3);
            // await unlock();
            if (!unlockUrl) return;
            window.location.href = unlockUrl;
        }
        run();
    }, [articlePrice, unlockUrl]);

    return (
        <div className={styles.floatingActions}>
            {step === 1 && (
                <Button
                    className={styles.floatingActions__buttonUnlock}
                    onClick={() => setStep(2)}
                >
                    Unlock with FRK
                </Button>
            )}
            {step === 2 && (
                <ul className={styles.floatingActions__list}>
                    {prices.map((price) => (
                        <li key={price.index}>
                            <ButtonUnlockArticle
                                price={price}
                                doUnlockArticle={() => setArticlePrice(price)}
                            />
                        </li>
                    ))}
                </ul>
            )}
            {step === 3 && <p>Redirecting...</p>}
            {/*{step === 3 && (
                <>
                    {unlockStatus === "waiting_signature" && (
                        <p>
                            Waiting approval{" "}
                            <span className={"dotsLoading"}>...</span>
                        </p>
                    )}
                    {unlockStatus === "waiting_tx" && (
                        <p>
                            Waiting for TX to be complete{" "}
                            <span className={"dotsLoading"}>...</span>
                        </p>
                    )}
                    {unlockStatus === "error" && errorMessage && (
                        <p className={"error"}>{errorMessage}</p>
                    )}
                </>
            )}*/}
        </div>
    );
}
