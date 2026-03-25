import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";

export function TokenItemLite({ token }: { token: BalanceItem }) {
    return (
        <Box
            as={"li"}
            display="flex"
            alignItems="center"
            gap="xs"
            padding="none"
        >
            <TokenLogo token={token} size={16} />
            <Text as="span" variant="bodySmall">
                {token.eurAmount} €
            </Text>
        </Box>
    );
}
