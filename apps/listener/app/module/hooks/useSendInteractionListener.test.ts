import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { renderHook } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { useSendInteractionListener } from "./useSendInteractionListener";

// Mock wallet-shared
const mockPushInteraction = vi.fn();
vi.mock("@frak-labs/wallet-shared", () => ({
    usePushInteraction: () => mockPushInteraction,
}));

describe("useSendInteractionListener", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should throw error if productId is missing", async ({
        mockProductId,
    }) => {
        const { result } = renderHook(() => useSendInteractionListener());

        const params = [undefined, { type: "test" }, undefined] as any;
        const context = { productId: mockProductId };

        await expect(result.current(params, context as any)).rejects.toThrow(
            "Missing productId or interaction"
        );
    });

    test("should throw error if interaction is missing", async ({
        mockProductId,
    }) => {
        const { result } = renderHook(() => useSendInteractionListener());

        const params = [mockProductId, undefined, undefined] as any;
        const context = { productId: mockProductId };

        await expect(result.current(params, context as any)).rejects.toThrow(
            "Missing productId or interaction"
        );
    });

    test("should throw error if productId in params doesn't match context", async ({
        mockProductId,
    }) => {
        const { result } = renderHook(() => useSendInteractionListener());

        const params = [mockProductId, { type: "test" }, undefined] as any;
        const context = { productId: "0x456" as `0x${string}` };

        const consoleSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        await expect(result.current(params, context as any)).rejects.toThrow(
            FrakRpcError
        );

        try {
            await result.current(params, context as any);
        } catch (error) {
            expect((error as FrakRpcError).code).toBe(
                RpcErrorCodes.configError
            );
            expect((error as FrakRpcError).message).toContain(
                "Product ID mismatch"
            );
        }

        expect(consoleSpy).toHaveBeenCalledWith(
            "Product ID in params doesn't match validated context",
            {
                paramsProductId: mockProductId,
                contextProductId: "0x456",
            }
        );

        consoleSpy.mockRestore();
    });

    test("should throw walletNotConnected error for pending-wallet status", async ({
        mockProductId,
    }) => {
        mockPushInteraction.mockResolvedValue({
            status: "pending-wallet",
            delegationId: undefined,
        });

        const { result } = renderHook(() => useSendInteractionListener());

        const params = [mockProductId, { type: "test" }, undefined] as any;
        const context = { productId: mockProductId };

        await expect(result.current(params, context as any)).rejects.toThrow(
            FrakRpcError
        );

        try {
            await result.current(params, context as any);
        } catch (error) {
            expect((error as FrakRpcError).code).toBe(
                RpcErrorCodes.walletNotConnected
            );
            expect((error as FrakRpcError).message).toContain(
                "User isn't connected"
            );
        }
    });

    test("should throw serverError for no-sdk-session status", async ({
        mockProductId,
    }) => {
        mockPushInteraction.mockResolvedValue({
            status: "no-sdk-session",
            delegationId: undefined,
        });

        const { result } = renderHook(() => useSendInteractionListener());

        const params = [mockProductId, { type: "test" }, undefined] as any;
        const context = { productId: mockProductId };

        await expect(result.current(params, context as any)).rejects.toThrow(
            FrakRpcError
        );

        try {
            await result.current(params, context as any);
        } catch (error) {
            expect((error as FrakRpcError).code).toBe(
                RpcErrorCodes.serverErrorForInteractionDelegation
            );
            expect((error as FrakRpcError).message).toContain(
                "Unable to get a safe token"
            );
        }
    });

    test("should throw serverError for push-error status", async ({
        mockProductId,
    }) => {
        mockPushInteraction.mockResolvedValue({
            status: "push-error",
            delegationId: undefined,
        });

        const { result } = renderHook(() => useSendInteractionListener());

        const params = [mockProductId, { type: "test" }, undefined] as any;
        const context = { productId: mockProductId };

        await expect(result.current(params, context as any)).rejects.toThrow(
            FrakRpcError
        );

        try {
            await result.current(params, context as any);
        } catch (error) {
            expect((error as FrakRpcError).code).toBe(
                RpcErrorCodes.serverErrorForInteractionDelegation
            );
            expect((error as FrakRpcError).message).toContain(
                "Unable to push the interaction"
            );
        }
    });

    test("should return delegationId on success", async ({ mockProductId }) => {
        const mockDelegationId = "delegation-123";
        mockPushInteraction.mockResolvedValue({
            status: "success",
            delegationId: mockDelegationId,
        });

        const { result } = renderHook(() => useSendInteractionListener());

        const params = [mockProductId, { type: "test" }, undefined] as any;
        const context = { productId: mockProductId };

        const response = await result.current(params, context as any);

        expect(response).toEqual({ delegationId: mockDelegationId });
        expect(mockPushInteraction).toHaveBeenCalledWith({
            productId: mockProductId,
            interaction: { type: "test" },
            signature: undefined,
        });
    });

    test("should pass signature to pushInteraction", async () => {
        mockPushInteraction.mockResolvedValue({
            status: "success",
            delegationId: "delegation-456",
        });

        const { result } = renderHook(() => useSendInteractionListener());

        const params = [
            "0x123" as `0x${string}`,
            { type: "test" },
            "signature-data",
        ] as any;
        const context = { productId: "0x123" as `0x${string}` };

        await result.current(params, context as any);

        expect(mockPushInteraction).toHaveBeenCalledWith({
            productId: "0x123",
            interaction: { type: "test" },
            signature: "signature-data",
        });
    });

    test("should handle BigInt productId comparison correctly", async () => {
        mockPushInteraction.mockResolvedValue({
            status: "success",
            delegationId: "delegation-789",
        });

        const { result } = renderHook(() => useSendInteractionListener());

        // Same value but different formats (BigInt conversion should handle this)
        const params = [
            "0x0123" as `0x${string}`,
            { type: "test" },
            undefined,
        ] as any;
        const context = { productId: "0x123" as `0x${string}` };

        const response = await result.current(params, context as any);

        expect(response).toEqual({ delegationId: "delegation-789" });
    });
});
