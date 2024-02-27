import { formatSecondDuration } from "@/module/article/utils/duration";
import { Button } from "@/module/common/component/Button";
import type { ArticlePrice } from "@frak-wallet/sdk/src/types/ArticlePrice";
import { formatEther } from "viem";
import type { Article } from "@/type/Article";

export function ButtonUnlockArticle({
    price,
    doUnlockArticle,
    disabled,
    provider,
}: {
    price: ArticlePrice;
    doUnlockArticle: (price: ArticlePrice) => void;
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
