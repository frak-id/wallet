import { Skeleton } from "@/module/common/component/Skeleton";
import { useGetUserTokens } from "@/module/tokens/hook/useGetUserTokens";
import { TokenItemLite } from "@/module/wallet/component/TokenItemLite";
import styles from "./index.module.css";

export function TokenListLite() {
    const { tokens, isLoading } = useGetUserTokens();

    if (isLoading) {
        return <Skeleton height={18} />;
    }

    return (
        tokens && (
            <ul className={styles.tokenListLite}>
                {tokens.map((token) => (
                    <TokenItemLite token={token} key={token.contractAddress} />
                ))}
            </ul>
        )
    );
}
