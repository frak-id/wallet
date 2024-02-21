import { FrakLogo } from "@/assets/icons/FrakLogo";
import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { ButtonUnlockArticle } from "@/module/article/component/ButtonUnlockArticle";
import type { Article } from "@/type/Article";
import { getUnlockRequestUrl } from "@frak-wallet/sdk";
import type {
    GetUnlockStatusResponse,
    GetUserStatusResponse,
    UnlockRequestResult,
} from "@frak-wallet/sdk";
import { formatHash } from "@frak-wallet/wallet/src/context/wallet/utils/hashFormatter";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { formatEther, fromHex } from "viem";
import styles from "./index.module.css";

export function UnlockButtons({
    prices,
    unlockStatus,
    userStatus,
    article,
}: {
    prices: ArticlePriceForUser[];
    unlockStatus: GetUnlockStatusResponse | UnlockRequestResult | undefined;
    userStatus: GetUserStatusResponse | undefined;
    article: Article | undefined;
}) {
    const [articlePrice, setArticlePrice] =
        useState<ArticlePriceForUser | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const isLocked =
        unlockStatus?.key === "expired" ||
        unlockStatus?.key === "not-unlocked" ||
        unlockStatus?.key === "error";

    const isInProgress =
        isLoading ||
        unlockStatus?.key === "preparing" ||
        unlockStatus?.key === "waiting-user-validation" ||
        unlockStatus?.key === "waiting-transaction-confirmation" ||
        unlockStatus?.key === "waiting-transaction-bundling";

    const balance =
        userStatus?.key === "logged-in" &&
        userStatus?.frkBalanceAsHex &&
        formatEther(fromHex(userStatus.frkBalanceAsHex as Hex, "bigint"));

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
            setIsLoading(true);
            window.location.href = unlockUrl;
        }
        redirect();
    }, [articlePrice, unlockUrl]);

    if (!(prices && article)) return null;

    function getMessages() {
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
        return "Loading";
    }

    return (
        <>
            <div
                className={`lmd-paywall__header ${
                    unlockStatus?.key === "valid"
                        ? styles["unlockButtons__header--valid"]
                        : ""
                }`}
            >
                <FrakLogo className={styles.unlockButtons__logo} />
                {unlockStatus?.key === "not-unlocked" ? "Unlock" : "Unlocked"}{" "}
                with Frak
            </div>
            <div
                className={`lmd-paywall__content ${
                    unlockStatus?.key === "valid"
                        ? styles["unlockButtons__content--valid"]
                        : ""
                }`}
            >
                <div
                    className={`${styles.unlockButtons} ${styles["unlockButtons--le-monde"]}`}
                >
                    <p className={"lmd-paywall__text"}>
                        {isInProgress ? (
                            <>
                                {getMessages()}{" "}
                                <span className={"dotsLoading"}>...</span>
                            </>
                        ) : (
                            <>
                                {isLocked && (
                                    <>
                                        {userStatus?.key === "not-logged-in" ? (
                                            <>
                                                A Frak account will be created
                                                during the unlock process.
                                            </>
                                        ) : (
                                            <>
                                                You are logged in with{" "}
                                                {formatHash(userStatus?.wallet)}
                                                <br />
                                                You have {balance} FRK
                                            </>
                                        )}
                                    </>
                                )}
                                {unlockStatus?.key === "valid" && (
                                    <>
                                        You have access to this article until{" "}
                                        <strong>
                                            {new Date(
                                                unlockStatus?.allowedUntil
                                            ).toLocaleString()}
                                        </strong>
                                    </>
                                )}
                                {/*{unlockStatus?.key === "error" &&
                                    unlockStatus?.reason}*/}
                            </>
                        )}
                    </p>

                    {isLocked && (
                        <ul className={styles.unlockButtons__list}>
                            {prices.map((price) => (
                                <li key={price.index}>
                                    <ButtonUnlockArticle
                                        disabled={
                                            userStatus?.key === "logged-in" &&
                                            balance < price.frkAmount
                                        }
                                        price={price}
                                        doUnlockArticle={() =>
                                            setArticlePrice(price)
                                        }
                                    />
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    );
}
