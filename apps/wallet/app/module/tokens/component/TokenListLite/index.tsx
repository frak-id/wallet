import { useEffect } from "react";
import { Skeleton } from "@/module/common/component/Skeleton";
import { TokenItemLite } from "@/module/tokens/component/TokenItemLite";
import { useGetUserBalance } from "@/module/tokens/hook/useGetUserBalance";
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
                {userBalance.balances.map((balance) => (
                    <TokenItemLite token={balance} key={balance.token} />
                ))}
            </ul>
        )
    );
}
