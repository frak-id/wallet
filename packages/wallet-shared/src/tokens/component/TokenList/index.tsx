import { Skeleton } from "@/common/component/Skeleton";
import { TokenItem } from "@/tokens/component/TokenItem";
import { useGetUserBalance } from "@/tokens/hook/useGetUserBalance";
import type { BalanceItem } from "@/types/Balance";
import styles from "./index.module.css";

export function TokenList({
    setSelectedValue,
}: {
    setSelectedValue?: (value: BalanceItem) => void;
}) {
    const { userBalance, isLoading } = useGetUserBalance();

    if (isLoading) {
        return <Skeleton height={100} />;
    }

    return (
        userBalance && (
            <ul className={styles.tokenList}>
                {userBalance.balances.map((balance: BalanceItem) => (
                    <TokenItem
                        token={balance}
                        key={balance.token}
                        setSelectedValue={setSelectedValue}
                    />
                ))}
            </ul>
        )
    );
}
