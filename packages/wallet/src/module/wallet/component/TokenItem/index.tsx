import { FrakToken } from "@/assets/icons/FrakToken";
import type { GetUserErc20Token } from "@/context/tokens/action/getTokenAsset";
import { formatEther } from "viem";
import styles from "./index.module.css";

export function TokenItem({ token }: { token: GetUserErc20Token }) {
    return (
        <li className={styles.tokenItem}>
            {token.metadata.name === "Frak" ? (
                <FrakToken />
            ) : token.metadata.logo ? (
                <img
                    src={token.metadata.logo}
                    alt={token.metadata.name}
                    width={16}
                    height={16}
                />
            ) : null}{" "}
            {formatEther(token.tokenBalance)} {token.metadata.symbol}
        </li>
    );
}
