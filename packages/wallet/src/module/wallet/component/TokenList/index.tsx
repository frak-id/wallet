import { useGetUserTokens } from "@/module/tokens/hook/useGetUserTokens";
import { TokenItem } from "@/module/wallet/component/TokenItem";
import styles from "./index.module.css";

export function TokenList() {
    const { tokens } = useGetUserTokens();

    return (
        tokens && (
            <ul className={styles.tokenList}>
                {tokens.map((token) => (
                    <TokenItem token={token} key={token.contractAddress} />
                ))}
            </ul>
        )
    );
}
