/**
 * Tests for useDisplayModal hook
 * Tests TanStack Mutation wrapper for displaying modals
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");

import type {
    LoginModalStepType,
    ModalRpcStepsResultType,
    SendTransactionModalStepType,
} from "@frak-labs/core-sdk";
import { displayModal } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { useDisplayModal } from "./useDisplayModal";

describe("useDisplayModal", () => {
    test("should throw ClientNotFound when client is not available", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useDisplayModal(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.mutate).toBeDefined();
        });

        result.current.mutate({
            steps: {
                login: {},
            },
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeInstanceOf(ClientNotFound);
    });

    test("should display modal with login step", async ({
        mockFrakProviders,
    }) => {
        const mockResult: ModalRpcStepsResultType<[LoginModalStepType]> = {
            login: {
                wallet: "0x1234567890123456789012345678901234567890",
            },
        };

        vi.mocked(displayModal).mockResolvedValue(mockResult as any);

        const { result } = renderHook(
            () => useDisplayModal<[LoginModalStepType]>(),
            {
                wrapper: mockFrakProviders,
            }
        );

        result.current.mutate({
            steps: {
                login: {},
            },
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
        expect(displayModal).toHaveBeenCalledTimes(1);
    });

    test("should display modal with sendTransaction step", async ({
        mockFrakProviders,
    }) => {
        const mockResult: ModalRpcStepsResultType<
            [SendTransactionModalStepType]
        > = {
            sendTransaction: {
                hash: "0x1234567890123456789012345678901234567890123456789012345678901234",
            },
        };

        vi.mocked(displayModal).mockResolvedValue(mockResult as any);

        const { result } = renderHook(
            () => useDisplayModal<[SendTransactionModalStepType]>(),
            {
                wrapper: mockFrakProviders,
            }
        );

        result.current.mutate({
            steps: {
                sendTransaction: {
                    tx: {
                        to: "0x1234567890123456789012345678901234567890",
                        data: "0x",
                    },
                },
            },
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
    });

    test("should display modal with custom metadata", async ({
        mockFrakProviders,
    }) => {
        const mockResult: ModalRpcStepsResultType<[LoginModalStepType]> = {
            login: { wallet: "0x1234567890123456789012345678901234567890" },
        };

        vi.mocked(displayModal).mockResolvedValue(mockResult as any);

        const { result } = renderHook(
            () => useDisplayModal<[LoginModalStepType]>(),
            {
                wrapper: mockFrakProviders,
            }
        );

        result.current.mutate({
            steps: {
                login: {},
            },
            metadata: {
                header: {
                    title: "Custom Login",
                },
            },
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(displayModal).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                metadata: expect.objectContaining({
                    header: {
                        title: "Custom Login",
                    },
                }),
            })
        );
    });

    test("should handle mutateAsync", async ({ mockFrakProviders }) => {
        const mockResult: ModalRpcStepsResultType<[LoginModalStepType]> = {
            login: { wallet: "0x1234567890123456789012345678901234567890" },
        };

        vi.mocked(displayModal).mockResolvedValue(mockResult as any);

        const { result } = renderHook(
            () => useDisplayModal<[LoginModalStepType]>(),
            {
                wrapper: mockFrakProviders,
            }
        );

        const response = await result.current.mutateAsync({
            steps: {
                login: {},
            },
        });

        expect(response).toEqual(mockResult);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
    });

    test("should handle RPC errors", async ({ mockFrakProviders }) => {
        const error = new Error("Modal display failed");
        vi.mocked(displayModal).mockRejectedValue(error);

        const { result } = renderHook(() => useDisplayModal(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            steps: {
                login: {},
            },
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });

    test("should handle mutation options", async ({ mockFrakProviders }) => {
        const mockResult: ModalRpcStepsResultType<[LoginModalStepType]> = {
            login: { wallet: "0x1234567890123456789012345678901234567890" },
        };

        vi.mocked(displayModal).mockResolvedValue(mockResult as any);

        const onSuccess = vi.fn();
        const onError = vi.fn();

        const { result } = renderHook(
            () =>
                useDisplayModal<[LoginModalStepType]>({
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
            steps: {
                login: {},
            },
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
    });

    test("should reset mutation state", async ({ mockFrakProviders }) => {
        const mockResult: ModalRpcStepsResultType<[LoginModalStepType]> = {
            login: { wallet: "0x1234567890123456789012345678901234567890" },
        };

        vi.mocked(displayModal).mockResolvedValue(mockResult as any);

        const { result } = renderHook(
            () => useDisplayModal<[LoginModalStepType]>(),
            {
                wrapper: mockFrakProviders,
            }
        );

        result.current.mutate({
            steps: {
                login: {},
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
