import { FrakLogo } from "@/assets/icons/FrakLogo";
import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { ButtonUnlockArticle } from "@/module/article/component/ButtonUnlockArticle";
import type { Article } from "@/type/Article";
import { getUnlockRequestUrl } from "@frak-wallet/sdk";
import type { GetUnlockStatusResponse } from "@frak-wallet/sdk";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import { useQuery } from "@tanstack/react-query";
import { useLocalStorage } from "@uidotdev/usehooks";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import styles from "./index.module.css";

export function UnlockButtons() {
    const [articlePrice, setArticlePrice] =
        useState<ArticlePriceForUser | null>(null);
    const [prices] = useLocalStorage<ArticlePriceForUser[] | null>(
        "prices",
        null
    );
    const [unlockStatus] = useLocalStorage<GetUnlockStatusResponse | null>(
        "unlockStatus",
        null
    );
    const [article] = useLocalStorage<Article | null>("article", null);

    const { data: unlockUrl } = useQuery({
        queryKey: [
            "getEncodedUnlockData",
            article?.id,
            articlePrice?.index ?? 0,
        ],
        queryFn: async () => {
            if (!(article && articlePrice)) return;

            return getUnlockRequestUrl(frakWalletSdkConfig, {
                articleId: article.id as Hex,
                articleTitle: article.title,
                imageUrl: article.imageUrl,
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
        async function redirect() {
            if (!unlockUrl) return;
            window.location.href = unlockUrl;
        }
        redirect();
    }, [articlePrice, unlockUrl]);

    if (!(prices && article)) return null;

    function getMessages() {
        if (unlockStatus?.status === "in-progress") {
            if (unlockStatus?.key === "preparing") {
                return "Loading";
            }
            if (unlockStatus?.key === "waiting-user-validation") {
                return "Waiting approval";
            }
            if (
                unlockStatus?.key === "waiting-transaction-bundling" ||
                unlockStatus?.key === "waiting-transaction-confirmation"
            ) {
                return "Waiting for TX to be complete";
            }
            if (unlockStatus?.key === "error") {
                return "Error";
            }
        }
    }

    return (
        <>
            <div className={"lmd-paywall__header"}>
                <FrakLogo className={styles.unlockButtons__logo} />
                {unlockStatus?.status === "unlocked" ? "Unlocked" : "Unlock"}{" "}
                with Frak
            </div>
            <div className={"lmd-paywall__content"}>
                <div
                    className={`${styles.unlockButtons} ${styles["unlockButtons--le-monde"]}`}
                >
                    {unlockStatus?.status === "in-progress" && (
                        <p className={"lmd-paywall__text"}>
                            {getMessages()}{" "}
                            <span className={"dotsLoading"}>...</span>
                        </p>
                    )}

                    {unlockStatus?.status === "unlocked" && (
                        <p className={"lmd-paywall__text"}>
                            You have access to this article until{" "}
                            <strong>18:12</strong>
                        </p>
                    )}

                    {unlockStatus?.status === "locked" && (
                        <>
                            <p className={"lmd-paywall__text"}>
                                {unlockStatus?.key === "not-logged-in" ? (
                                    <>
                                        A Frak account will be created during
                                        the unlock process.
                                    </>
                                ) : (
                                    <>
                                        You are logged in with 0xAbC..DeF
                                        <br />
                                        You have 155 FRK
                                    </>
                                )}
                            </p>
                            <ul className={styles.unlockButtons__list}>
                                {prices.map((price) => (
                                    <li key={price.index}>
                                        <ButtonUnlockArticle
                                            price={price}
                                            doUnlockArticle={() =>
                                                setArticlePrice(price)
                                            }
                                        />
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}
