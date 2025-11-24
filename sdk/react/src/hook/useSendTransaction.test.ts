/**
 * Tests for useSendTransactionAction hook
 * Tests TanStack Mutation wrapper for sending transactions
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");

import type { SendTransactionReturnType } from "@frak-labs/core-sdk";
import { sendTransaction } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { useSendTransactionAction } from "./useSendTransaction";

describe("useSendTransactionAction", () => {
    test("should throw ClientNotFound when client is not available", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useSendTransactionAction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.mutate).toBeDefined();
        });

        result.current.mutate({
            tx: {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x",
            },
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeInstanceOf(ClientNotFound);
    });

    test("should send transaction successfully", async ({
        mockFrakProviders,
    }) => {
        const mockResult: SendTransactionReturnType = {
            hash: "0xabcdef1234567890" as Hex,
        };

        vi.mocked(sendTransaction).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSendTransactionAction(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            tx: {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x",
            },
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
        expect(sendTransaction).toHaveBeenCalledTimes(1);
    });

    test("should send transaction with metadata", async ({
        mockFrakProviders,
    }) => {
        const mockResult: SendTransactionReturnType = {
            hash: "0xhash123" as Hex,
        };

        vi.mocked(sendTransaction).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSendTransactionAction(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            tx: {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x",
            },
            metadata: {
                header: {
                    title: "Send Transaction",
                },
            },
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
    });

    test("should handle mutateAsync", async ({ mockFrakProviders }) => {
        const mockResult: SendTransactionReturnType = {
            hash: "0xasync123" as Hex,
        };

        vi.mocked(sendTransaction).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSendTransactionAction(), {
            wrapper: mockFrakProviders,
        });

        const response = await result.current.mutateAsync({
            tx: {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x",
            },
        });

        expect(response).toEqual(mockResult);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
    });

    test("should handle RPC errors", async ({ mockFrakProviders }) => {
        const error = new Error("Transaction send failed");
        vi.mocked(sendTransaction).mockRejectedValue(error);

        const { result } = renderHook(() => useSendTransactionAction(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            tx: {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x",
            },
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });

    test("should handle mutation options", async ({ mockFrakProviders }) => {
        const mockResult: SendTransactionReturnType = {
            hash: "0xoptions123" as Hex,
        };

        vi.mocked(sendTransaction).mockResolvedValue(mockResult);

        const onSuccess = vi.fn();
        const onError = vi.fn();

        const { result } = renderHook(
            () =>
                useSendTransactionAction({
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
            tx: {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x",
            },
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    test("should reset mutation state", async ({ mockFrakProviders }) => {
        const mockResult: SendTransactionReturnType = {
            hash: "0xreset123" as Hex,
        };

        vi.mocked(sendTransaction).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSendTransactionAction(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            tx: {
                to: "0x1234567890123456789012345678901234567890",
                data: "0x",
            },
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
