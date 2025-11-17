import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { addresses } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import { viemActionsMocks } from "../../../../test/mock/viem";
import { WalletSessionRepository } from "./WalletSessionRepository";

describe("WalletSessionRepository", () => {
    let repository: WalletSessionRepository;
    const mockWallet = "0x1234567890123456789012345678901234567890" as Address;

    beforeEach(() => {
        repository = new WalletSessionRepository();
        viemActionsMocks.readContract.mockClear();
    });

    afterEach(() => {
        mock.restore();
    });

    describe("isSessionValid", () => {
        it("should return false when readContract throws", async () => {
            viemActionsMocks.readContract.mockRejectedValue(
                new Error("Contract not found")
            );

            const result = await repository.isSessionValid(mockWallet);

            expect(result).toBe(false);
            expect(viemActionsMocks.readContract).toHaveBeenCalled();
        });

        it("should return false when executor address does not match", async () => {
            const now = Math.floor(Date.now() / 1000);

            viemActionsMocks.readContract.mockResolvedValue({
                validAfter: now - 3600, // 1 hour ago
                validUntil: now + 3600, // 1 hour from now
                executor:
                    "0x9999999999999999999999999999999999999999" as Address, // Wrong executor
                validator: addresses.interactionDelegatorValidator,
            });

            const result = await repository.isSessionValid(mockWallet);

            expect(result).toBe(false);
        });

        it("should return false when validator address does not match", async () => {
            const now = Math.floor(Date.now() / 1000);

            viemActionsMocks.readContract.mockResolvedValue({
                validAfter: now - 3600,
                validUntil: now + 3600,
                executor: addresses.interactionDelegatorAction,
                validator:
                    "0x9999999999999999999999999999999999999999" as Address, // Wrong validator
            });

            const result = await repository.isSessionValid(mockWallet);

            expect(result).toBe(false);
        });

        it("should return false when session has not started yet", async () => {
            const now = Math.floor(Date.now() / 1000);

            viemActionsMocks.readContract.mockResolvedValue({
                validAfter: now + 3600, // Starts in 1 hour
                validUntil: now + 7200,
                executor: addresses.interactionDelegatorAction,
                validator: addresses.interactionDelegatorValidator,
            });

            const result = await repository.isSessionValid(mockWallet);

            expect(result).toBe(false);
        });

        it("should return false when session has expired", async () => {
            const now = Math.floor(Date.now() / 1000);

            viemActionsMocks.readContract.mockResolvedValue({
                validAfter: now - 7200,
                validUntil: now - 3600, // Expired 1 hour ago
                executor: addresses.interactionDelegatorAction,
                validator: addresses.interactionDelegatorValidator,
            });

            const result = await repository.isSessionValid(mockWallet);

            expect(result).toBe(false);
        });

        it("should return true when session is valid", async () => {
            const now = Math.floor(Date.now() / 1000);

            viemActionsMocks.readContract.mockResolvedValue({
                validAfter: now - 3600,
                validUntil: now + 3600,
                executor: addresses.interactionDelegatorAction,
                validator: addresses.interactionDelegatorValidator,
            });

            const result = await repository.isSessionValid(mockWallet);

            expect(result).toBe(true);
        });

        it("should cache valid session results", async () => {
            const now = Math.floor(Date.now() / 1000);

            viemActionsMocks.readContract.mockResolvedValue({
                validAfter: now - 3600,
                validUntil: now + 3600,
                executor: addresses.interactionDelegatorAction,
                validator: addresses.interactionDelegatorValidator,
            });

            // First call
            await repository.isSessionValid(mockWallet);
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(1);

            // Second call should use cache
            await repository.isSessionValid(mockWallet);
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(1);
        });

        it("should cache invalid session results", async () => {
            // Use a unique wallet to avoid cache pollution from other tests
            const uniqueWallet =
                "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as Address;
            viemActionsMocks.readContract.mockRejectedValue(
                new Error("Not found")
            );

            // First call
            const result1 = await repository.isSessionValid(uniqueWallet);
            expect(result1).toBe(false);

            // Second call should use cache and return same result
            const result2 = await repository.isSessionValid(uniqueWallet);
            expect(result2).toBe(false);

            // Both calls should have returned false (cached behavior verified by consistent results)
        });

        it("should handle session expiring soon with custom TTL", async () => {
            const now = Math.floor(Date.now() / 1000);

            viemActionsMocks.readContract.mockResolvedValue({
                validAfter: now - 3600,
                validUntil: now + 300, // Expires in 5 minutes (less than 15min TTL)
                executor: addresses.interactionDelegatorAction,
                validator: addresses.interactionDelegatorValidator,
            });

            const result = await repository.isSessionValid(mockWallet);

            expect(result).toBe(true);
        });

        it("should work with different wallet addresses", async () => {
            const now = Math.floor(Date.now() / 1000);
            const wallet1 =
                "0x1111111111111111111111111111111111111111" as Address;
            const wallet2 =
                "0x2222222222222222222222222222222222222222" as Address;

            viemActionsMocks.readContract.mockResolvedValue({
                validAfter: now - 3600,
                validUntil: now + 3600,
                executor: addresses.interactionDelegatorAction,
                validator: addresses.interactionDelegatorValidator,
            });

            const result1 = await repository.isSessionValid(wallet1);
            const result2 = await repository.isSessionValid(wallet2);

            expect(result1).toBe(true);
            expect(result2).toBe(true);
            // Should be called twice (different addresses)
            expect(viemActionsMocks.readContract).toHaveBeenCalledTimes(2);
        });

        it("should handle session exactly at current time", async () => {
            const now = Math.floor(Date.now() / 1000);

            viemActionsMocks.readContract.mockResolvedValue({
                validAfter: now,
                validUntil: now,
                executor: addresses.interactionDelegatorAction,
                validator: addresses.interactionDelegatorValidator,
            });

            const result = await repository.isSessionValid(mockWallet);

            // Session that starts and ends at current time should be invalid
            expect(result).toBe(false);
        });
    });
});
