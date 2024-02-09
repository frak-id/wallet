import styles from "./index.module.css";
import { Button } from "@/module/common/component/Button";
import type { ArticlePrice } from "@frak-wallet/sdk/src/types/ArticlePrice";

export function ButtonUnlockArticle({
    price,
    doUnlockArticle,
    disabled,
}: {
    price: ArticlePrice;
    doUnlockArticle: () => void;
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
                {/*{price.index === 2 ? "1 month" : price?.durationFormatted}*/}
                {/*<br />*/}
                {price.frkAmount} FRK
            </span>
        </Button>
    );
}
