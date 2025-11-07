import { describe, expect, it } from "vitest";
import { encodeWalletMulticall } from "./multicall";

describe("encodeWalletMulticall", () => {
    const mockAddress1 = "0x1234567890123456789012345678901234567890";
    const mockAddress2 = "0xabcdef1234567890123456789012345678901234";

    it("should encode single transaction", () => {
        const txs = [
            {
                to: mockAddress1,
                data: "0x123456",
                value: 100n,
            },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
        expect(result.length).toBeGreaterThan(10);
    });

    it("should encode multiple transactions", () => {
        const txs = [
            {
                to: mockAddress1,
                data: "0x123456",
                value: 100n,
            },
            {
                to: mockAddress2,
                data: "0xabcdef",
                value: 200n,
            },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should handle transaction without data", () => {
        const txs = [
            {
                to: mockAddress1,
                value: 100n,
            },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should handle transaction without value", () => {
        const txs = [
            {
                to: mockAddress1,
                data: "0x123456",
            },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should handle transaction with only address", () => {
        const txs = [
            {
                to: mockAddress1,
            },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should handle empty transactions array", () => {
        const txs = [] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should handle zero value", () => {
        const txs = [
            {
                to: mockAddress1,
                data: "0x123456",
                value: 0n,
            },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should handle empty data", () => {
        const txs = [
            {
                to: mockAddress1,
                data: "0x",
                value: 100n,
            },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should handle large value amounts", () => {
        const txs = [
            {
                to: mockAddress1,
                value: 1000000000000000000n, // 1 ETH in wei
            },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should handle long data payloads", () => {
        const longData = `0x${"ab".repeat(500)}`;
        const txs = [
            {
                to: mockAddress1,
                data: longData as `0x${string}`,
            },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should encode different transaction types in batch", () => {
        const txs = [
            { to: mockAddress1, value: 100n },
            { to: mockAddress2, data: "0x123456" },
            {
                to: mockAddress1,
                data: "0xabcdef",
                value: 200n,
            },
            { to: mockAddress2 },
        ] as const;

        const result = encodeWalletMulticall(txs);

        expect(result).toBeDefined();
        expect(result).toMatch(/^0x/);
    });

    it("should return consistent encoding for same input", () => {
        const txs = [
            {
                to: mockAddress1,
                data: "0x123456",
                value: 100n,
            },
        ] as const;

        const result1 = encodeWalletMulticall(txs);
        const result2 = encodeWalletMulticall(txs);

        expect(result1).toBe(result2);
    });
});
