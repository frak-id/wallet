import { describe, expect, test } from "vitest";
import { balanceKey } from "../../common/queryKeys/balance";
import { userBalanceQueryOptions } from "./useGetUserBalance";

describe("userBalanceQueryOptions", () => {
    test("uses the shared balance key so loader and hook share one cache entry", () => {
        const address = "0x1234567890123456789012345678901234567890" as const;
        expect(userBalanceQueryOptions(address).queryKey).toEqual(
            balanceKey.byAddress(address)
        );
    });

    test("falls back to the no-address key and stays disabled without an address", () => {
        const options = userBalanceQueryOptions();
        expect(options.queryKey).toEqual(balanceKey.byAddress());
        expect(options.enabled).toBe(false);
    });
});
