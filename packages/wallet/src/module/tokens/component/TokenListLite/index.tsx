import { Skeleton } from "@/module/common/component/Skeleton";
import { TokenItemLite } from "@/module/tokens/component/TokenItemLite";
import { useGetUserTokens } from "@/module/tokens/hook/useGetUserTokens";
import { useEffect } from "react";
import styles from "./index.module.css";

export function TokenListLite() {
    const { tokens, isLoading, refetch } = useGetUserTokens();

    useEffect(() => {
        refetch();
    }, [refetch]);

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
