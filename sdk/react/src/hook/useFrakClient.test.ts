/**
 * Tests for useFrakClient hook
 * Tests that the hook correctly retrieves the FrakClient from context
 */

import { renderHook } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { FrakIFrameClientContext } from "../provider/FrakIFrameClientProvider";
import { useFrakClient } from "./useFrakClient";

describe("useFrakClient", () => {
    test("should return undefined when used outside provider", () => {
        const { result } = renderHook(() => useFrakClient());

        expect(result.current).toBeUndefined();
    });

    test("should return client when used inside provider", ({
        mockFrakClient,
    }) => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            createElement(
                FrakIFrameClientContext.Provider,
                { value: mockFrakClient },
                children
            );

        const { result } = renderHook(() => useFrakClient(), {
            wrapper,
        });

        expect(result.current).toBe(mockFrakClient);
    });

    test("should return the same client instance across re-renders", ({
        mockFrakClient,
    }) => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            createElement(
                FrakIFrameClientContext.Provider,
                { value: mockFrakClient },
                children
            );

        const { result, rerender } = renderHook(() => useFrakClient(), {
            wrapper,
        });

        const firstClient = result.current;
        rerender();
        const secondClient = result.current;

        expect(firstClient).toBe(secondClient);
        expect(firstClient).toBe(mockFrakClient);
    });

    test("should update when provider value changes", ({
        mockFrakClient,
        mockFrakConfig,
    }) => {
        const newMockClient = {
            ...mockFrakClient,
            config: {
                ...mockFrakConfig,
                domain: "new-domain.com",
            },
        };

        let currentClient = mockFrakClient;

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            createElement(
                FrakIFrameClientContext.Provider,
                { value: currentClient },
                children
            );

        const { result, rerender } = renderHook(() => useFrakClient(), {
            wrapper,
        });

        // Initially returns first client
        expect(result.current).toBe(mockFrakClient);

        // Update the client in provider
        currentClient = newMockClient;
        rerender();

        // Should return new client
        expect(result.current).toBe(newMockClient);
        expect(result.current?.config.domain).toBe("new-domain.com");
    });

    test("should handle client becoming undefined", ({ mockFrakClient }) => {
        let currentClient: typeof mockFrakClient | undefined = mockFrakClient;

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            createElement(
                FrakIFrameClientContext.Provider,
                { value: currentClient },
                children
            );

        const { result, rerender } = renderHook(() => useFrakClient(), {
            wrapper,
        });

        // Initially returns client
        expect(result.current).toBe(mockFrakClient);

        // Set client to undefined
        currentClient = undefined;
        rerender();

        // Should return undefined
        expect(result.current).toBeUndefined();
    });
});
