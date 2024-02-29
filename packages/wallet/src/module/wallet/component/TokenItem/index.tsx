import type { GetUserErc20Token } from "@/context/tokens/action/getTokenAsset";
import { TokenLogo } from "@/module/wallet/component/TokenLogo";
import { formatEther } from "viem";
import styles from "./index.module.css";

export function TokenItem({
    token,
    setSelectedValue,
}: {
    token: GetUserErc20Token;
    setSelectedValue?: (value: GetUserErc20Token) => void;
}) {
    return (
        <li className={`${styles.tokenItem}`}>
            <button
                type={"button"}
                className={styles.tokenItem__button}
                onClick={() => setSelectedValue?.(token)}
                aria-label={`Select ${token.metadata.symbol}`}
            >
                <TokenLogo token={token} size={32} />{" "}
                <span>
                    <strong>{formatEther(token.tokenBalance)}</strong>{" "}
                    {token.metadata.symbol}
                </span>
            </button>
        </li>
    );
}
