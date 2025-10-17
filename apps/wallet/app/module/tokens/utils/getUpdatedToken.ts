import type { BalanceItem } from "@frak-labs/wallet-shared/types/Balance";
import { isAddressEqual, zeroAddress } from "viem";

export function getUpdatedToken({
    tokens,
    selectedToken,
}: {
    tokens: BalanceItem[];
    selectedToken: BalanceItem;
}) {
    return tokens.find(
        ({ token, amount }) =>
            isAddressEqual(token, selectedToken?.token ?? zeroAddress) &&
            amount !== selectedToken?.amount
    );
}
