import type { GetUserErc20Token } from "@/context/tokens/action/getTokenAsset";
import { TokenLogo } from "@/module/wallet/component/TokenLogo";
import { formatEther } from "viem";
import styles from "./index.module.css";

export function TokenItemLite({
    token,
}: {
    token: GetUserErc20Token;
}) {
    return (
        <li className={`${styles.tokenItemLite}`}>
            <TokenLogo token={token} size={16} />{" "}
            {formatEther(token.tokenBalance)} {token.metadata.symbol}
        </li>
    );
}
