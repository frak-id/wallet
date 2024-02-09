import { formatSecondDuration } from "@/module/article/utils/duration";
import { Button } from "@/module/common/component/Button";
import type { ArticlePrice } from "@frak-wallet/sdk/src/types/ArticlePrice";
import { formatEther } from "viem";
import styles from "./index.module.css";

export function ButtonUnlockArticle({
    price,
    doUnlockArticle,
    disabled,
}: {
    price: ArticlePrice;
    doUnlockArticle: (price: ArticlePrice) => void;
    disabled?: boolean;
}) {
    return (
        <Button
            size={"small"}
            className={styles.button}
            disabled={disabled}
            onClick={() => doUnlockArticle(price)}
        >
            <span>
                {price.index === 2
                    ? "1 month"
                    : formatSecondDuration(price?.unlockDurationInSec)}
                <br />
                {formatEther(BigInt(price.frkAmount))} FRK
            </span>
        </Button>
    );
}
