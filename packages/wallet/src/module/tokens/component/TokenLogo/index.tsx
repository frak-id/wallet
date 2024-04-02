import { FrakToken } from "@/assets/icons/FrakToken";
import type { GetUserErc20Token } from "@/context/tokens/action/getTokenAsset";
import styles from "./index.module.css";

export function TokenLogo({
    token,
    size = 24,
}: { token?: GetUserErc20Token; size?: number }) {
    return (
        token && (
            <span className={styles.tokenLogo}>
                {token.metadata.symbol.indexOf("FRK") >= 0 ? (
                    <FrakToken size={size} />
                ) : token.metadata.logo ? (
                    <img
                        src={token.metadata.logo}
                        alt={token.metadata.name}
                        width={size}
                        height={size}
                    />
                ) : null}
            </span>
        )
    );
}
