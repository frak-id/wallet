import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { Skeleton } from "@/module/common/component/Skeleton";
import { TokenItemLite } from "@/module/tokens/component/TokenItemLite";
import styles from "./index.module.css";

export function TokenListLite() {
    const { userBalance, isLoading } = useGetUserBalance();

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
