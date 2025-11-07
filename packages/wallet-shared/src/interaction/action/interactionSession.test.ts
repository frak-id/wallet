import { addresses, getExecutionAbi } from "@frak-labs/app-essentials";
import type { Address } from "viem";
import * as viemActions from "viem/actions";
import { describe, expect, it, vi } from "vitest";
import { getSessionStatus } from "./interactionSession";

vi.mock("viem/actions", () => ({
    readContract: vi.fn(),
}));

vi.mock("../../blockchain/provider", () => ({
    currentViemClient: {},
}));

describe("getSessionStatus", () => {
    const mockWallet: Address = "0x1234567890123456789012345678901234567890";

    it("should return null when readContract throws error", async () => {
        vi.mocked(viemActions.readContract).mockRejectedValue(
            new Error("Contract read failed")
        );

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result).toBeNull();
    });

    it("should return null when readContract returns null", async () => {
        vi.mocked(viemActions.readContract).mockResolvedValue(null);

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result).toBeNull();
    });

    it("should return null when executor does not match", async () => {
        const now = Math.floor(Date.now() / 1000);
        const mockStatus = {
            executor: "0x0000000000000000000000000000000000000000",
            validator: addresses.interactionDelegatorValidator,
            validAfter: now - 3600,
            validUntil: now + 3600,
        };

        vi.mocked(viemActions.readContract).mockResolvedValue(mockStatus);

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result).toBeNull();
    });

    it("should return null when validator does not match", async () => {
        const now = Math.floor(Date.now() / 1000);
        const mockStatus = {
            executor: addresses.interactionDelegatorAction,
            validator: "0x0000000000000000000000000000000000000000",
            validAfter: now - 3600,
            validUntil: now + 3600,
        };

        vi.mocked(viemActions.readContract).mockResolvedValue(mockStatus);

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result).toBeNull();
    });

    it("should return null when session has not started yet", async () => {
        const now = Math.floor(Date.now() / 1000);
        const futureTime = now + 7200;
        const mockStatus = {
            executor: addresses.interactionDelegatorAction,
            validator: addresses.interactionDelegatorValidator,
            validAfter: futureTime,
            validUntil: futureTime + 3600,
        };

        vi.mocked(viemActions.readContract).mockResolvedValue(mockStatus);

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result).toBeNull();
    });

    it("should return null when session has expired", async () => {
        const now = Math.floor(Date.now() / 1000);
        const pastTime = now - 7200;
        const mockStatus = {
            executor: addresses.interactionDelegatorAction,
            validator: addresses.interactionDelegatorValidator,
            validAfter: pastTime - 3600,
            validUntil: pastTime,
        };

        vi.mocked(viemActions.readContract).mockResolvedValue(mockStatus);

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result).toBeNull();
    });

    it("should return session when valid and active", async () => {
        const now = Math.floor(Date.now() / 1000);
        const startTime = now - 3600;
        const endTime = now + 3600;

        const mockStatus = {
            executor: addresses.interactionDelegatorAction,
            validator: addresses.interactionDelegatorValidator,
            validAfter: startTime,
            validUntil: endTime,
        };

        vi.mocked(viemActions.readContract).mockResolvedValue(mockStatus);

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result).not.toBeNull();
        expect(result?.sessionStart).toBe(startTime * 1000);
        expect(result?.sessionEnd).toBe(endTime * 1000);
    });

    it("should call readContract with correct parameters", async () => {
        const now = Math.floor(Date.now() / 1000);
        const mockStatus = {
            executor: addresses.interactionDelegatorAction,
            validator: addresses.interactionDelegatorValidator,
            validAfter: now - 3600,
            validUntil: now + 3600,
        };

        vi.mocked(viemActions.readContract).mockResolvedValue(mockStatus);

        await getSessionStatus({ wallet: mockWallet });

        expect(viemActions.readContract).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                address: mockWallet,
                abi: [getExecutionAbi],
                functionName: "getExecution",
            })
        );
    });

    it("should convert timestamps to milliseconds", async () => {
        const now = Math.floor(Date.now() / 1000);
        const startSeconds = now - 1800; // 30 minutes ago
        const endSeconds = now + 1800; // 30 minutes from now

        const mockStatus = {
            executor: addresses.interactionDelegatorAction,
            validator: addresses.interactionDelegatorValidator,
            validAfter: startSeconds,
            validUntil: endSeconds,
        };

        vi.mocked(viemActions.readContract).mockResolvedValue(mockStatus);

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result?.sessionStart).toBe(startSeconds * 1000);
        expect(result?.sessionEnd).toBe(endSeconds * 1000);
    });

    it("should handle session that starts exactly now", async () => {
        const now = Math.floor(Date.now() / 1000);

        const mockStatus = {
            executor: addresses.interactionDelegatorAction,
            validator: addresses.interactionDelegatorValidator,
            validAfter: now,
            validUntil: now + 3600,
        };

        vi.mocked(viemActions.readContract).mockResolvedValue(mockStatus);

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result).not.toBeNull();
    });

    it("should handle session that ends exactly now", async () => {
        const now = Math.floor(Date.now() / 1000);

        const mockStatus = {
            executor: addresses.interactionDelegatorAction,
            validator: addresses.interactionDelegatorValidator,
            validAfter: now - 3600,
            validUntil: now,
        };

        vi.mocked(viemActions.readContract).mockResolvedValue(mockStatus);

        const result = await getSessionStatus({ wallet: mockWallet });

        expect(result).toBeNull();
    });
});
