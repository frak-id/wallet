import { ClientNotFound } from "@frak-labs/core-sdk";
import * as ReactQuery from "@tanstack/react-query";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import * as React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useFrakClient } from "../useFrakClient";
import { useWalletStatus } from "../useWalletStatus";
import { useFrakContext } from "../utils/useFrakContext";
import { useReferralInteraction } from "./useReferralInteraction";

// Mock types
type MockFn<TReturn = unknown> = {
    mockReturnValue: (value: TReturn) => void;
    mockImplementation: (impl: (...args: unknown[]) => TReturn) => void;
};

// Mock useQuery from react-query
vi.mock("@tanstack/react-query", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@tanstack/react-query")>();
    return {
        ...actual,
        useQuery: vi.fn(),
    };
});

// Mock the dependencies
vi.mock("../useFrakClient", () => ({
    useFrakClient: vi.fn(),
}));

vi.mock("../useWalletStatus", () => ({
    useWalletStatus: vi.fn(),
}));

vi.mock("../utils/useFrakContext", () => ({
    useFrakContext: vi.fn(),
}));

// Mock the processReferral function
const mockProcessReferral = vi.fn();
vi.mock("@frak-labs/core-sdk/actions", () => ({
    processReferral: (client: unknown, options: unknown) =>
        mockProcessReferral(client, options),
}));

describe("useReferralInteraction", () => {
    let queryClient: QueryClient;
    let useQueryMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                },
            },
        });

        // Reset all mocks before each test
        vi.clearAllMocks();

        // Store useQuery mock for easier access
        useQueryMock = vi.mocked(ReactQuery.useQuery);

        // Default mock implementations
        (useFrakClient as unknown as MockFn).mockReturnValue({
            config: { domain: "test" },
        });

        (useWalletStatus as unknown as MockFn).mockReturnValue({
            data: { key: "test-key" },
        });

        (useFrakContext as unknown as MockFn).mockReturnValue({
            frakContext: { r: "test-referrer" },
        });

        // Default processReferral mock
        mockProcessReferral.mockResolvedValue("idle");

        // Default useQuery mock
        useQueryMock.mockReturnValue({
            data: undefined,
            error: undefined,
            status: "pending",
        });
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => {
        return React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children
        );
    };

    it("should return 'idle' when wallet status is not available", () => {
        // Set wallet status to undefined
        (useWalletStatus as unknown as MockFn).mockReturnValue({
            data: undefined,
        });

        // When wallet status is undefined, the query won't run due to 'enabled: !!walletStatus'
        // So we need to mock as if query never ran (neither loading nor error state)
        useQueryMock.mockReturnValue({
            data: undefined,
            error: undefined,
            status: "success", // Not pending, not error - simulating query that didn't run
        });

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper,
        });

        expect(result.current).toBe("idle");
    });

    it("should return 'processing' when query is pending", () => {
        // Set the query status to pending
        useQueryMock.mockReturnValue({
            data: undefined,
            error: undefined,
            status: "pending",
        });

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper,
        });

        expect(result.current).toBe("processing");
    });

    it("should return error when client is not found", () => {
        // Set useFrakClient to return undefined
        (useFrakClient as unknown as MockFn).mockReturnValue(undefined);

        // Set the query to return an error
        const clientNotFound = new ClientNotFound();
        useQueryMock.mockReturnValue({
            data: undefined,
            error: clientNotFound,
            status: "error",
        });

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper,
        });

        expect(result.current).toEqual(clientNotFound);
    });

    it("should return referral state when query is successful", () => {
        const mockReferralState = { success: true };

        // Mock successful query response
        useQueryMock.mockReturnValue({
            data: mockReferralState,
            error: undefined,
            status: "success",
        });

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper,
        });

        expect(result.current).toEqual(mockReferralState);
    });

    it("should use provided productId in query key", () => {
        const productId = "0x123";

        // Track the query key used
        let capturedQueryKey: unknown[] = [];
        useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => {
            capturedQueryKey = options.queryKey;
            return {
                data: undefined,
                error: undefined,
                status: "pending",
            };
        });

        renderHook(() => useReferralInteraction({ productId }), { wrapper });

        // Verify productId is in query key
        expect(capturedQueryKey).toContain(productId);
    });

    it("should use default values in query key when not provided", () => {
        // Track the query key used
        let capturedQueryKey: unknown[] = [];
        useQueryMock.mockImplementation((options: { queryKey: unknown[] }) => {
            capturedQueryKey = options.queryKey;
            return {
                data: undefined,
                error: undefined,
                status: "pending",
            };
        });

        renderHook(() => useReferralInteraction(), { wrapper });

        // Verify default value is in query key
        expect(capturedQueryKey).toContain("no-product-id");
    });
});
