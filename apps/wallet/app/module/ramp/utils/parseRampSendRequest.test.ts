import type { Address } from "viem";
import { describe, expect, test } from "@/tests/vitest-fixtures";
import { isRampSendError, parseRampSendRequest } from "./parseRampSendRequest";

const USDC: Address = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
const DEPOSIT: Address = "0x2222222222222222222222222222222222222222";
const usdcInfo = { address: USDC.toLowerCase(), decimals: 6 };
const expected = { token: USDC, balance: 50_000_000n };

function rejection(request: Parameters<typeof parseRampSendRequest>[0]) {
    try {
        parseRampSendRequest(request, expected);
    } catch (error) {
        return isRampSendError(error) ? error.reason : "unexpected";
    }
    return "accepted";
}

describe("parseRampSendRequest", () => {
    test("accepts a base-unit USDC amount within the balance", () => {
        expect(
            parseRampSendRequest(
                { assetInfo: usdcInfo, amount: "20000000", address: DEPOSIT },
                expected
            )
        ).toEqual({ token: USDC, to: DEPOSIT, amount: 20_000_000n });
    });

    test("parses a decimal amount with the asset decimals", () => {
        expect(
            parseRampSendRequest(
                { assetInfo: usdcInfo, amount: "20.5", address: DEPOSIT },
                expected
            ).amount
        ).toBe(20_500_000n);
    });

    test.each([
        [
            "unsupported_asset",
            { address: null, decimals: 18 },
            "20000000",
            DEPOSIT,
        ],
        [
            "unsupported_asset",
            {
                address: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8",
                decimals: 6,
            },
            "20000000",
            DEPOSIT,
        ],
        ["invalid_address", usdcInfo, "20000000", "not-an-address"],
        ["invalid_amount", usdcInfo, "-1", DEPOSIT],
        ["invalid_amount", usdcInfo, "20", DEPOSIT],
        ["insufficient_balance", usdcInfo, "50000001", DEPOSIT],
    ] as const)("rejects with %s", (reason, assetInfo, amount, address) => {
        expect(rejection({ assetInfo, amount, address })).toBe(reason);
    });
});
