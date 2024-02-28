import css from "!!raw-loader!./index.module.css";
import { FrakLogo } from "@/assets/icons/FrakLogo";
import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { ButtonUnlockArticle } from "@/module/article/component/ButtonUnlockArticle";
import type { Article } from "@/type/Article";
import { getStartArticleUnlockUrl } from "@frak-wallet/sdk/actions";
import type {
    ArticleUnlockStatusReturnType,
    UnlockOptionsReturnType,
    WalletStatusReturnType,
} from "@frak-wallet/sdk/core";
import { formatHash } from "@frak-wallet/wallet/src/context/wallet/utils/hashFormatter";
import type { ArticlePriceForUser } from "@frak-wallet/wallet/src/types/Price";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { type Hex, fromHex } from "viem";
import { formatEther } from "viem";

export const cssRaw = css;

export function UnlockButtons({
    prices,
    unlockStatus,
    walletStatus,
    article,
}: {
    prices: UnlockOptionsReturnType["prices"];
    unlockStatus: ArticleUnlockStatusReturnType | undefined;
    walletStatus: WalletStatusReturnType | undefined;
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
        walletStatus?.key === "connected" &&
        walletStatus?.frkBalanceAsHex &&
        formatEther(fromHex(walletStatus.frkBalanceAsHex, "bigint"));

    const { data: unlockUrl } = useQuery({
        queryKey: [
            "getEncodedUnlockData",
            article?.id,
            articlePrice?.index ?? 0,
        ],
        queryFn: async () => {
            if (!(article && articlePrice)) return;

            return getStartArticleUnlockUrl(frakWalletSdkConfig, {
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

    const stylesHeader =
        unlockStatus?.key === "valid" ? "unlockButtons__header--valid" : "";
    const stylesContent =
        unlockStatus?.key === "valid" ? "unlockButtons__content--valid" : "";

    return (
        <div className={`unlockButtons unlockButtons--${article.provider}`}>
            <div className={`unlockButtons__header ${stylesHeader}`}>
                <FrakLogo className={"unlockButtons__logo"} />
                {unlockStatus?.key === "valid" ? "Unlocked" : "Unlock"} with
                Frak
            </div>
            <div className={`unlockButtons__content ${stylesContent}`}>
                <p className={"unlockButtons__text"}>
                    {isInProgress ? (
                        <>
                            {getMessages()}{" "}
                            <span className={"dotsLoading"}>...</span>
                        </>
                    ) : (
                        <>
                            {isLocked && (
                                <>
                                    {walletStatus?.key === "not-connected" ? (
                                        <>
                                            A Frak account will be created
                                            during the unlock process.
                                        </>
                                    ) : (
                                        <>
                                            You are logged in with{" "}
                                            {formatHash(walletStatus?.wallet)}
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

                {isLocked && !isInProgress && (
                    <ul className={"unlockButtons__list"}>
                        {prices.map((price) => {
                            const priceInEther = Number(
                                formatEther(BigInt(price.frkAmount))
                            );
                            return (
                                <li key={price.index}>
                                    <ButtonUnlockArticle
                                        provider={article.provider}
                                        disabled={
                                            walletStatus?.key === "connected" &&
                                            Number(balance) < priceInEther
                                        }
                                        price={price}
                                        doUnlockArticle={() =>
                                            setArticlePrice(price)
                                        }
                                    />
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>
        </div>
    );
}
