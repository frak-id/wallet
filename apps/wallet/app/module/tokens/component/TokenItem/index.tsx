import type { BalanceItem } from "@frak-labs/wallet-shared/types/Balance";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";
import styles from "./index.module.css";

export function TokenItem({
    token,
    setSelectedValue,
}: {
    token: BalanceItem;
    setSelectedValue?: (value: BalanceItem) => void;
}) {
    return (
        <li className={`${styles.tokenItem}`}>
            <button
                type={"button"}
                className={styles.tokenItem__button}
                onClick={() => setSelectedValue?.(token)}
                aria-label={`Select ${token.symbol}`}
            >
                <TokenLogo token={token} size={32} />{" "}
                <span>
                    <strong>{token.amount}</strong> {token.symbol}
                </span>
            </button>
        </li>
    );
}
