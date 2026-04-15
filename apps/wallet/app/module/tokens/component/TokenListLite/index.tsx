import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { TokenItemLite } from "@/module/tokens/component/TokenItemLite";

export function TokenListLite() {
    const { userBalance, isLoading } = useGetUserBalance();

    if (isLoading) {
        return <Skeleton variant="rect" height={18} width="100%" />;
    }

    return (
        userBalance && (
            <Stack as="ul" space="xs">
                {userBalance.balances.map((balance: BalanceItem) => (
                    <TokenItemLite token={balance} key={balance.token} />
                ))}
            </Stack>
        )
    );
}
