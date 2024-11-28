import { Skeleton } from "@/module/common/component/Skeleton";
import { TokenItem } from "@/module/tokens/component/TokenItem";
import { useGetUserBalance } from "@/module/tokens/hook/useGetUserBalance";
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
                {userBalance.balances.map((balance) => (
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
