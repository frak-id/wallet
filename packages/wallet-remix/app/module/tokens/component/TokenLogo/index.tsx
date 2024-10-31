import type { BalanceItem } from "@/types/Token";
import { FrakToken } from "./FrakToken";
import styles from "./index.module.css";

export function TokenLogo({
    token,
    size = 24,
}: { token?: BalanceItem; size?: number }) {
    return (
        token && (
            <span className={styles.tokenLogo}>
                {token.symbol.indexOf("FRK") >= 0 ? (
                    <FrakToken size={size} />
                ) : null}
            </span>
        )
    );
}
