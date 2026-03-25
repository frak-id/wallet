import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { TokenItem } from "@/module/tokens/component/TokenItem";

export function TokenList({
    setSelectedValue,
}: {
    setSelectedValue?: (value: BalanceItem) => void;
}) {
    const { userBalance, isLoading } = useGetUserBalance();

    if (isLoading) {
        return <Skeleton variant="rect" height={100} width="100%" />;
    }

    if (!userBalance) {
        return null;
    }

    if (userBalance.balances.length === 0) {
        return (
            <EmptyState
                title="No tokens yet"
                description="Your wallet has no token balances."
            />
        );
    }

    return (
        <Stack as="ul" space="xs">
            {userBalance.balances.map((balance: BalanceItem) => (
                <TokenItem
                    token={balance}
                    key={balance.token}
                    setSelectedValue={setSelectedValue}
                />
            ))}
        </Stack>
    );
}
