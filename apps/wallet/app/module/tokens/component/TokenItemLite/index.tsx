import type { BalanceItem } from "@frak-labs/wallet-shared";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";
import styles from "./index.module.css";

export function TokenItemLite({ token }: { token: BalanceItem }) {
    return (
        <li className={`${styles.tokenItemLite}`}>
            <TokenLogo token={token} size={16} /> {token.eurAmount}
            {" €"}
        </li>
    );
}
