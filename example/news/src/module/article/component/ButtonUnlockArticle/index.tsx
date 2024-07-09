import { formatSecondDuration } from "@/module/article/utils/duration";
import { Button } from "@/module/common/component/Button";
import { useConvertToEuro } from "@/module/common/hook/useConvertToEuro";
import type { Article } from "@/type/Article";
import type { PaidArticleUnlockPrice } from "@frak-labs/nexus-sdk/core";
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
    // Get the price in euro
    const { convertToEuro } = useConvertToEuro();

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
                {convertToEuro(formatEther(BigInt(price.frkAmount)), "FRK")}
            </span>
        </Button>
    );
}
