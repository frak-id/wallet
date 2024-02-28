import { formatSecondDuration } from "@/module/article/utils/duration";
import { Button } from "@/module/common/component/Button";
import type { Article } from "@/type/Article";
import type { PaidArticleUnlockPrice } from "@frak-wallet/sdk/core";
import { formatEther } from "viem";

export function ButtonUnlockArticle({
    price,
    doUnlockArticle,
    disabled,
    provider,
}: {
    price: PaidArticleUnlockPrice;
    doUnlockArticle: (price: PaidArticleUnlockPrice) => void;
    disabled?: boolean;
    provider: Article["provider"];
}) {
    return (
        <Button
            variant={provider}
            size={"small"}
            disabled={disabled}
            onClick={() => doUnlockArticle(price)}
        >
            <span>
                <strong>
                    {price.index === 2
                        ? "1 month"
                        : formatSecondDuration(price?.unlockDurationInSec)}
                </strong>
                <br />
                {formatEther(BigInt(price.frkAmount))} FRK
            </span>
        </Button>
    );
}
