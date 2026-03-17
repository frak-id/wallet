import { Box } from "@frak-labs/ui/component/Box";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { Skeleton } from "@/module/common/component/Skeleton";
import { TokenItem } from "@/module/tokens/component/TokenItem";

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
            <Box as="ul" direction="column" gap="s" padding="none">
                {userBalance.balances.map((balance: BalanceItem) => (
                    <TokenItem
                        token={balance}
                        key={balance.token}
                        setSelectedValue={setSelectedValue}
                    />
                ))}
            </Box>
        )
    );
}
