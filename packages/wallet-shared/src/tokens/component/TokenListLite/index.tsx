import { useEffect } from "react";
import { Skeleton } from "@/common/component/Skeleton";
import { TokenItemLite } from "@/tokens/component/TokenItemLite";
import { useGetUserBalance } from "@/tokens/hook/useGetUserBalance";
import type { BalanceItem } from "@/types/Balance";
import styles from "./index.module.css";

export function TokenListLite() {
    const { userBalance, isLoading, refetch } = useGetUserBalance();

    useEffect(() => {
        refetch();
    }, [refetch]);

    if (isLoading) {
        return <Skeleton height={18} />;
    }

    return (
        userBalance && (
            <ul className={styles.tokenListLite}>
                {userBalance.balances.map((balance: BalanceItem) => (
                    <TokenItemLite token={balance} key={balance.token} />
                ))}
            </ul>
        )
    );
}
