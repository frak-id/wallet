import type { BalanceItem } from "@frak-labs/wallet-shared";
import { type Address, getAddress } from "viem";
import { resolveSelectedToken } from "@/module/tokens/utils/resolveSelectedToken";
import { describe, expect, test } from "@/tests/vitest-fixtures";

describe("resolveSelectedToken", () => {
    const otherTokenAddress =
        "0xabcdef1234567890123456789012345678901234" as Address;

    const createToken = (address: Address, amount: number): BalanceItem => ({
        token: address,
        name: "Test Token",
        symbol: "TEST",
        decimals: 18,
        rawBalance: "0x0",
        amount,
        eurAmount: amount,
        usdAmount: amount,
        gbpAmount: amount,
    });

    test("returns undefined when there are no balances", () => {
        expect(
            resolveSelectedToken({
                tokens: undefined,
                selectedAddress: undefined,
            })
        ).toBeUndefined();
        expect(
            resolveSelectedToken({ tokens: [], selectedAddress: undefined })
        ).toBeUndefined();
    });

    test("defaults to the first balance when nothing is selected yet", ({
        mockAddress,
    }) => {
        const tokens = [
            createToken(mockAddress, 100),
            createToken(otherTokenAddress, 50),
        ];

        expect(
            resolveSelectedToken({ tokens, selectedAddress: undefined })
        ).toBe(tokens[0]);
    });

    test("tracks the selected address across a balance refresh", ({
        mockAddress,
    }) => {
        // The regression this guards: the amount changed, so an identity-based
        // sync would hand back a stale item (or loop re-syncing it).
        const refreshed = [
            createToken(mockAddress, 150),
            createToken(otherTokenAddress, 50),
        ];

        const result = resolveSelectedToken({
            tokens: refreshed,
            selectedAddress: mockAddress,
        });

        expect(result?.token).toBe(mockAddress);
        expect(result?.amount).toBe(150);
    });

    test("selects the non-default token when that is the selection", ({
        mockAddress,
    }) => {
        const tokens = [
            createToken(mockAddress, 100),
            createToken(otherTokenAddress, 50),
        ];

        const result = resolveSelectedToken({
            tokens,
            selectedAddress: otherTokenAddress,
        });

        expect(result?.token).toBe(otherTokenAddress);
        expect(result?.amount).toBe(50);
    });

    test("matches addresses irrespective of checksum casing", ({
        mockAddress,
    }) => {
        const tokens = [createToken(getAddress(mockAddress), 100)];

        const result = resolveSelectedToken({
            tokens,
            selectedAddress: mockAddress.toLowerCase() as Address,
        });

        expect(result?.amount).toBe(100);
    });

    test("falls back to the first balance when the selection disappears", ({
        mockAddress,
    }) => {
        const tokens = [createToken(otherTokenAddress, 50)];

        const result = resolveSelectedToken({
            tokens,
            selectedAddress: mockAddress,
        });

        // Never leave the screen pointing at a token that is no longer held.
        expect(result?.token).toBe(otherTokenAddress);
    });
});
