/**
 * Tests for useGetProductInformation hook
 * Tests TanStack Query wrapper for fetching product information
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");

import type { GetProductInformationReturnType } from "@frak-labs/core-sdk";
import { getProductInformation } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import type { Address, Hex } from "viem";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { useGetProductInformation } from "./useGetProductInformation";

describe("useGetProductInformation", () => {
    test("should throw ClientNotFound when client is not available", async ({
        queryWrapper,
    }) => {
        // Render hook without FrakClient provider
        const { result } = renderHook(() => useGetProductInformation(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeInstanceOf(ClientNotFound);
    });

    test("should fetch product information successfully", async ({
        mockFrakProviders,
    }) => {
        const mockProductInfo: GetProductInformationReturnType = {
            id: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
            onChainMetadata: {
                name: "Test Product",
                domain: "example.com",
                productTypes: ["press"],
            },
            rewards: [],
        };

        vi.mocked(getProductInformation).mockResolvedValue(mockProductInfo);

        const { result } = renderHook(() => useGetProductInformation(), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockProductInfo);
        expect(getProductInformation).toHaveBeenCalledTimes(1);
    });

    test("should return product information with rewards", async ({
        mockFrakProviders,
    }) => {
        const mockProductInfo: GetProductInformationReturnType = {
            id: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
            onChainMetadata: {
                name: "Test Product",
                domain: "example.com",
                productTypes: ["press", "purchase"],
            },
            maxReferrer: {
                amount: 100,
                eurAmount: 10,
                usdAmount: 12,
                gbpAmount: 9,
            },
            maxReferee: {
                amount: 50,
                eurAmount: 5,
                usdAmount: 6,
                gbpAmount: 4.5,
            },
            rewards: [
                {
                    token: "0x1234567890123456789012345678901234567890" as Address,
                    campaign:
                        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as Address,
                    interactionTypeKey: "press.readArticle",
                    referrer: {
                        amount: 10,
                        eurAmount: 1,
                        usdAmount: 1.2,
                        gbpAmount: 0.9,
                    },
                    referee: {
                        amount: 5,
                        eurAmount: 0.5,
                        usdAmount: 0.6,
                        gbpAmount: 0.45,
                    },
                },
            ],
        };

        vi.mocked(getProductInformation).mockResolvedValue(mockProductInfo);

        const { result } = renderHook(() => useGetProductInformation(), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockProductInfo);

        // Type assertion needed because TanStack Query's data type is too narrow
        const data = result.current
            .data as unknown as GetProductInformationReturnType;
        expect(data.rewards).toHaveLength(1);
        expect(data.maxReferrer).toBeDefined();
        expect(data.maxReferee).toBeDefined();
    });

    test("should handle query options", async ({ mockFrakProviders }) => {
        const mockProductInfo: GetProductInformationReturnType = {
            id: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
            onChainMetadata: {
                name: "Test Product",
                domain: "example.com",
                productTypes: ["press"],
            },
            rewards: [],
        };

        vi.mocked(getProductInformation).mockResolvedValue(mockProductInfo);

        const { result } = renderHook(
            () =>
                useGetProductInformation({
                    query: {
                        enabled: true,
                        staleTime: 5000,
                    },
                }),
            {
                wrapper: mockFrakProviders,
            }
        );

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockProductInfo);
    });

    test("should handle RPC errors", async ({ mockFrakProviders }) => {
        const error = new Error("RPC request failed");
        vi.mocked(getProductInformation).mockRejectedValue(error);

        const { result } = renderHook(() => useGetProductInformation(), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toEqual(error);
    });

    test("should use correct query key", async ({ mockFrakProviders }) => {
        const mockProductInfo: GetProductInformationReturnType = {
            id: "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex,
            onChainMetadata: {
                name: "Test Product",
                domain: "example.com",
                productTypes: ["press"],
            },
            rewards: [],
        };

        vi.mocked(getProductInformation).mockResolvedValue(mockProductInfo);

        const { result } = renderHook(() => useGetProductInformation(), {
            wrapper: mockFrakProviders,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        // Query key should be stable
        expect(result.current.data).toEqual(mockProductInfo);
    });
});
