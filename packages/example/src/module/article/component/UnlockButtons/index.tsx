import css from "!!raw-loader!./index.module.css";
import { FrakLogo } from "@/assets/icons/FrakLogo";
import { frakWalletSdkConfig } from "@/context/frak-wallet/config";
import { ButtonUnlockArticle } from "@/module/article/component/ButtonUnlockArticle";
import type { Article } from "@/type/Article";
import { getStartArticleUnlockUrl } from "@frak-labs/nexus-sdk/actions";
import type { UnlockOptionsReturnType } from "@frak-labs/nexus-sdk/core";
import type {
    ArticleUnlockStatusQueryReturnType,
    WalletStatusQueryReturnType,
} from "@frak-labs/nexus-sdk/react";
import { formatHash } from "@frak-labs/nexus-wallet/src/context/wallet/utils/hashFormatter";
import type { ArticlePriceForUser } from "@frak-labs/nexus-wallet/src/types/Price";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { Hex } from "viem";
import { formatEther } from "viem";

export const cssRaw = css;

export function UnlockButtons({
    prices,
    unlockStatus,
    walletStatus,
    article,
}: {
    prices: UnlockOptionsReturnType["prices"];
    unlockStatus: ArticleUnlockStatusQueryReturnType | undefined;
    walletStatus: WalletStatusQueryReturnType | undefined;
    article: Article | undefined;
}) {
    const [articlePrice, setArticlePrice] = useState<
        ArticlePriceForUser | undefined
    >(undefined);
    const [isLoading, setIsLoading] = useState(false);

    const isLocked = unlockStatus?.status !== "unlocked";

    const isInProgress = isLoading || unlockStatus?.status === "in-progress";

    const balance =
        walletStatus?.key === "connected" && walletStatus?.frkBalanceAsHex
            ? formatEther(BigInt(walletStatus.frkBalanceAsHex))
            : undefined;

    const { data: unlockUrl } = useUnlockRedirectUrl({ article, articlePrice });

    /**
     * Auto redirect the user when unlock url is ready
     */
    useEffect(() => {
        if (!articlePrice) return;
        async function redirect() {
            if (!unlockUrl) return;
            setIsLoading(true);
            window.location.href = unlockUrl;
        }
        redirect();
    }, [articlePrice, unlockUrl]);

    /**
     * Message to display
     */
    const message = useMemo(() => {
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
            return "Unlock transaction in progress";
        }
        return "Loading";
    }, [unlockStatus?.key]);

    if (!(prices && article)) return null;

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
                            {message} <span className={"dotsLoading"}>...</span>
                        </>
                    ) : (
                        <>
                            {isLocked && (
                                <LockedWalletStatusInfo
                                    walletStatus={walletStatus}
                                />
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

/**
 * Small component for the wallet status text
 * @param walletStatus
 * @constructor
 */
function LockedWalletStatusInfo({
    walletStatus,
}: { walletStatus: WalletStatusQueryReturnType | undefined }) {
    if (!walletStatus || walletStatus.key === "waiting-response") {
        return <>Fetching your current wallet...</>;
    }

    // If not connected status
    if (walletStatus.key === "not-connected") {
        return <>A Frak account will be created during the unlock process.</>;
    }

    // Otherwise, connected and ready to use
    return (
        <>
            You are logged in with {formatHash(walletStatus?.wallet)}
            <br />
            You have {formatEther(BigInt(walletStatus.frkBalanceAsHex))} pFRK
        </>
    );
}

const useUnlockRedirectUrl = ({
    article,
    articlePrice,
}: { article?: Article; articlePrice?: ArticlePriceForUser }) =>
    useQuery({
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
                provider: article.provider,
            });
        },
        enabled: !!article && !!articlePrice,
    });
