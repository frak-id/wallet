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
});
