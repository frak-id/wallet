import { addresses } from "@frak-labs/app-essentials";
import { describe, expect, it } from "vitest";
import {
    type Address,
    decodeFunctionData,
    getAddress,
    type Hex,
    keccak256,
    toHex,
} from "viem";
import {
    erc20TransferAbi,
    rewarderClaimAbi,
} from "@/module/tokens/utils/abi";
import type {
    LoserAssetSummary,
    LoserAssetSummaryEntry,
} from "../hook/useLoserAssetSummary";
import { buildAssetMigrationCalls } from "./buildAssetMigrationCalls";

const LOSER = getAddress("0x1111111111111111111111111111111111111111");
const WINNER = getAddress("0x2222222222222222222222222222222222222222");
const TOKEN_A = getAddress("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
const TOKEN_B = getAddress("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

function entry(
    overrides: Partial<LoserAssetSummaryEntry> = {}
): LoserAssetSummaryEntry {
    return {
        id: "usdc",
        token: TOKEN_A,
        symbol: "USDC",
        decimals: 6,
        balance: 0n,
        claimable: 0n,
        ...overrides,
    };
}

function summary(entries: LoserAssetSummaryEntry[]): LoserAssetSummary {
    return {
        loser: LOSER,
        entries,
        hasFunds: entries.some(
            (item) => item.balance > 0n || item.claimable > 0n
        ),
    };
}

function decodeTransfer(data: Hex) {
    return decodeFunctionData({
        abi: [erc20TransferAbi],
        data,
    });
}

function decodeClaim(data: Hex) {
    return decodeFunctionData({
        abi: [rewarderClaimAbi],
        data,
    });
}

describe("buildAssetMigrationCalls", () => {
    it("returns no calls when the summary holds no funds", () => {
        const calls = buildAssetMigrationCalls({
            summary: summary([]),
            winner: WINNER,
        });
        expect(calls).toEqual([]);
    });

    it("emits only a transfer when balance is non-zero and claimable is zero", () => {
        const calls = buildAssetMigrationCalls({
            summary: summary([entry({ balance: 1_000_000n })]),
            winner: WINNER,
        });
        expect(calls).toHaveLength(1);
        const [transfer] = calls;
        expect(transfer.to).toBe(TOKEN_A);
        expect(transfer.value).toBe(0n);
        expect(decodeTransfer(transfer.data)).toEqual({
            functionName: "transfer",
            args: [WINNER, 1_000_000n],
        });
    });

    it("emits a claim then a transfer when claimable is non-zero and balance is zero", () => {
        const calls = buildAssetMigrationCalls({
            summary: summary([entry({ claimable: 500_000n })]),
            winner: WINNER,
        });
        expect(calls).toHaveLength(2);
        const [claim, transfer] = calls;
        expect(claim.to).toBe(addresses.rewarderHub);
        expect(decodeClaim(claim.data)).toEqual({
            functionName: "claim",
            args: [TOKEN_A],
        });
        expect(transfer.to).toBe(TOKEN_A);
        expect(decodeTransfer(transfer.data)).toEqual({
            functionName: "transfer",
            args: [WINNER, 500_000n],
        });
    });

    it("transfers balance + claimable when both are non-zero", () => {
        const calls = buildAssetMigrationCalls({
            summary: summary([
                entry({ balance: 1_000_000n, claimable: 250_000n }),
            ]),
            winner: WINNER,
        });
        expect(calls).toHaveLength(2);
        expect(decodeTransfer(calls[1].data)).toEqual({
            functionName: "transfer",
            args: [WINNER, 1_250_000n],
        });
    });

    it("preserves per-token ordering with claim immediately preceding its transfer", () => {
        const calls = buildAssetMigrationCalls({
            summary: summary([
                entry({
                    id: "usdc",
                    token: TOKEN_A,
                    balance: 1n,
                    claimable: 2n,
                }),
                entry({
                    id: "eure",
                    token: TOKEN_B,
                    decimals: 18,
                    balance: 0n,
                    claimable: 3n,
                }),
            ]),
            winner: WINNER,
        });

        expect(calls).toHaveLength(4);
        expect(calls[0].to).toBe(addresses.rewarderHub);
        expect(decodeClaim(calls[0].data).args).toEqual([TOKEN_A]);
        expect(calls[1].to).toBe(TOKEN_A);
        expect(decodeTransfer(calls[1].data).args).toEqual([WINNER, 3n]);
        expect(calls[2].to).toBe(addresses.rewarderHub);
        expect(decodeClaim(calls[2].data).args).toEqual([TOKEN_B]);
        expect(calls[3].to).toBe(TOKEN_B);
        expect(decodeTransfer(calls[3].data).args).toEqual([WINNER, 3n]);
    });

    it("uses the same selector as the production claim ABI", () => {
        const calls = buildAssetMigrationCalls({
            summary: summary([entry({ claimable: 1n })]),
            winner: WINNER,
        });
        const expectedSelector = keccak256(toHex("claim(address)")).slice(
            0,
            10
        );
        expect(calls[0].data.startsWith(expectedSelector)).toBe(true);
    });
});
