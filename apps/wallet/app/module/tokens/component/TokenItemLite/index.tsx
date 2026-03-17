import { Box } from "@frak-labs/ui/component/Box";
import type { BalanceItem } from "@frak-labs/wallet-shared";
import { TokenLogo } from "@/module/tokens/component/TokenLogo";

export function TokenItemLite({ token }: { token: BalanceItem }) {
    return (
        <Box
            as={"li"}
            direction={"row"}
            align={"center"}
            gap={"s"}
            padding={"none"}
        >
            <TokenLogo token={token} size={16} /> {token.eurAmount}
            {" €"}
        </Box>
    );
}
