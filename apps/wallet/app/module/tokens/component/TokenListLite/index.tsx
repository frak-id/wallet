import { Box } from "@frak-labs/ui/component/Box";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { Skeleton } from "@/module/common/component/Skeleton";
import { TokenItemLite } from "@/module/tokens/component/TokenItemLite";

export function TokenListLite() {
    const { userBalance, isLoading } = useGetUserBalance();

    if (isLoading) {
        return <Skeleton height={18} />;
    }

    return (
        userBalance && (
            <Box as="ul" direction="column" gap="s" padding="none">
                {userBalance.balances.map((balance: BalanceItem) => (
                    <TokenItemLite token={balance} key={balance.token} />
                ))}
            </Box>
        )
    );
}
