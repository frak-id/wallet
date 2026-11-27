// Stands in for app/hooks/useMerchantBank, whose RPC multicall is blocked offline. Scenario from ?bank=open|paused|empty|lowlimit.
import { currentStablecoins } from "@frak-labs/app-essentials/blockchain";
import type { useMerchantBank as realUseMerchantBank } from "app/hooks/useMerchantBank";
import type { Address } from "viem";

export function useMerchantBank({
    bankAddress,
}: {
    bankAddress?: Address | null;
}) {
    const scenario =
        new URLSearchParams(window.location.search).get("bank") ?? "open";
    const tokens = Object.entries(currentStablecoins).map(
        ([symbol, address], i) => {
            const decimals = symbol.toLowerCase().includes("usd") ? 6 : 18;
            const unit = 10n ** BigInt(decimals);
            const empty = scenario === "empty" || i > 0;
            const limit = scenario === "lowlimit" ? 1000n : 5000n;
            return {
                symbol,
                address: address as Address,
                balance: empty ? 0n : 1250n * unit,
                allowance: empty ? 0n : limit * unit,
                decimals,
            };
        }
    );
    const data = bankAddress
        ? { isOpen: scenario !== "paused", tokens }
        : undefined;
    return {
        data: data satisfies ReturnType<typeof realUseMerchantBank>["data"],
        isLoading: false,
        isPending: false,
        isSuccess: true,
        refetch: async () => undefined,
    };
}
