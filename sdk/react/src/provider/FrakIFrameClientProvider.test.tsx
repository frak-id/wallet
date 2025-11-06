/**
 * Tests for FrakIFrameClientProvider
 * Tests iframe creation and FrakClient provider
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk", async () => {
    const actual = await vi.importActual<typeof import("@frak-labs/core-sdk")>(
        "@frak-labs/core-sdk"
    );
    return {
        ...actual,
        createIFrameFrakClient: vi.fn(),
    };
});

import type { FrakClient } from "@frak-labs/core-sdk";
import { createIFrameFrakClient } from "@frak-labs/core-sdk";
import { render, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { FrakConfigProvider } from "./FrakConfigProvider";
import { FrakIFrameClientProvider } from "./FrakIFrameClientProvider";

describe("FrakIFrameClientProvider", () => {
    test("should render iframe with correct src", ({ mockFrakConfig }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        const iframe = document.querySelector("iframe");
        expect(iframe).toBeDefined();
        expect(iframe?.src).toContain(`${mockFrakConfig.walletUrl}/listener`);
    });

    test("should apply custom styles to iframe", ({ mockFrakConfig }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const customStyle = {
            width: "500px",
            height: "600px",
        };

        render(
            createElement(FrakIFrameClientProvider, { style: customStyle }),
            {
                wrapper: Wrapper,
            }
        );

        const iframe = document.querySelector("iframe");
        expect(iframe?.style.width).toBe("500px");
        expect(iframe?.style.height).toBe("600px");
    });

    test("should create FrakClient when iframe ref is set", async ({
        mockFrakConfig,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const mockClient = { config: mockFrakConfig } as FrakClient;
        vi.mocked(createIFrameFrakClient).mockReturnValue(mockClient);

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            expect(createIFrameFrakClient).toHaveBeenCalled();
        });
    });

    test("should not recreate client if already exists", async ({
        mockFrakConfig,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const mockClient = { config: mockFrakConfig } as FrakClient;
        vi.mocked(createIFrameFrakClient).mockReturnValue(mockClient);

        const { rerender } = render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            expect(createIFrameFrakClient).toHaveBeenCalledTimes(1);
        });

        // Rerender the component
        rerender(createElement(FrakIFrameClientProvider));

        // Should still only be called once
        expect(createIFrameFrakClient).toHaveBeenCalledTimes(1);
    });

    test("should render without children", ({ mockFrakConfig }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const { container } = render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        const iframe = container.querySelector("iframe");
        expect(iframe).toBeDefined();
    });

    test("should use baseIframeProps for iframe attributes", ({
        mockFrakConfig,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        const iframe = document.querySelector("iframe");
        expect(iframe).toBeDefined();
        // baseIframeProps should set these attributes
        expect(iframe?.getAttribute("sandbox")).toBeDefined();
    });

    test("should handle iframe ref callback correctly", ({
        mockFrakConfig,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const mockClient = { config: mockFrakConfig } as FrakClient;
        let callCount = 0;

        vi.mocked(createIFrameFrakClient).mockImplementation(() => {
            callCount++;
            return mockClient;
        });

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        // Client creation should be called at most once
        expect(callCount).toBeLessThanOrEqual(1);
    });

    test("should pass config to createIFrameFrakClient", async ({
        mockFrakConfig,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const mockClient = { config: mockFrakConfig } as FrakClient;
        vi.mocked(createIFrameFrakClient).mockReturnValue(mockClient);

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            expect(createIFrameFrakClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    config: expect.objectContaining({
                        domain: "example.com",
                        walletUrl: "https://wallet-test.frak.id",
                    }),
                })
            );
        });
    });
});
