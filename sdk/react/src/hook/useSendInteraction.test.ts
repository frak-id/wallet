/**
 * Tests for useSendInteraction hook
 * Tests TanStack Mutation wrapper for sending interactions
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");

import type {
    PreparedInteraction,
    SendInteractionReturnType,
} from "@frak-labs/core-sdk";
import { sendInteraction } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { useSendInteraction } from "./useSendInteraction";

describe("useSendInteraction", () => {
    const mockInteraction: PreparedInteraction = {
        interactionData: "0xdata" as Hex,
        handlerTypeDenominator: "0x01" as Hex,
    };

    test("should throw ClientNotFound when client is not available", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useSendInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.mutate).toBeDefined();
        });

        result.current.mutate({
            interaction: mockInteraction,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeInstanceOf(ClientNotFound);
    });

    test("should send interaction successfully", async ({
        mockFrakProviders,
    }) => {
        const mockResult: SendInteractionReturnType = {
            delegationId: "delegation-123",
        };

        vi.mocked(sendInteraction).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSendInteraction(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            interaction: mockInteraction,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
        expect(sendInteraction).toHaveBeenCalledTimes(1);
    });

    test("should send interaction with productId", async ({
        mockFrakProviders,
    }) => {
        const mockResult: SendInteractionReturnType = {
            delegationId: "delegation-456",
        };

        vi.mocked(sendInteraction).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSendInteraction(), {
            wrapper: mockFrakProviders,
        });

        const productId =
            "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex;

        result.current.mutate({
            productId,
            interaction: mockInteraction,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
        expect(sendInteraction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                productId,
                interaction: mockInteraction,
            })
        );
    });

    test("should send interaction with validation signature", async ({
        mockFrakProviders,
    }) => {
        const mockResult: SendInteractionReturnType = {
            delegationId: "delegation-789",
        };

        vi.mocked(sendInteraction).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSendInteraction(), {
            wrapper: mockFrakProviders,
        });

        const validation = "0xsignature123" as Hex;

        result.current.mutate({
            interaction: mockInteraction,
            validation,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
        expect(sendInteraction).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                interaction: mockInteraction,
                validation,
            })
        );
    });

    test("should handle mutateAsync", async ({ mockFrakProviders }) => {
        const mockResult: SendInteractionReturnType = {
            delegationId: "delegation-async",
        };

        vi.mocked(sendInteraction).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSendInteraction(), {
            wrapper: mockFrakProviders,
        });

        const response = await result.current.mutateAsync({
            interaction: mockInteraction,
        });

        expect(response).toEqual(mockResult);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
    });

    test("should handle RPC errors", async ({ mockFrakProviders }) => {
        const error = new Error("Interaction send failed");
        vi.mocked(sendInteraction).mockRejectedValue(error);

        const { result } = renderHook(() => useSendInteraction(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            interaction: mockInteraction,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });

    test("should handle mutation options", async ({ mockFrakProviders }) => {
        const mockResult: SendInteractionReturnType = {
            delegationId: "delegation-with-options",
        };

        vi.mocked(sendInteraction).mockResolvedValue(mockResult);

        const onSuccess = vi.fn();
        const onError = vi.fn();

        const { result } = renderHook(
            () =>
                useSendInteraction({
                    mutations: {
                        onSuccess,
                        onError,
                    },
                }),
            {
                wrapper: mockFrakProviders,
            }
        );

        result.current.mutate({
            interaction: mockInteraction,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    test("should reset mutation state", async ({ mockFrakProviders }) => {
        const mockResult: SendInteractionReturnType = {
            delegationId: "delegation-reset",
        };

        vi.mocked(sendInteraction).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSendInteraction(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            interaction: mockInteraction,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        result.current.reset();

        await waitFor(() => {
            expect(result.current.data).toBeUndefined();
            expect(result.current.isIdle).toBe(true);
        });
    });
});
