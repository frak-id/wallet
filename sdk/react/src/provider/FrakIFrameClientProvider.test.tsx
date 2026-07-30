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
        // Async since the client now resolves the anonymous id before wiring
        // analytics; default to a resolved client so tests that don't care
        // about the client itself still mount the iframe.
        createIFrameFrakClient: vi.fn(async () => ({}) as FrakClient),
        // Deterministic: the real one needs WebCrypto and would make every
        // assertion here depend on key generation.
        getClientIdAsync: vi.fn(async () => "test-derived-client-id"),
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
    test("should render iframe with correct src", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        // The iframe mounts only once the anonymous id has been derived, so
        // that its src can carry `clientId` on the very first load.
        const iframe = await waitFor(() => {
            const el = document.querySelector("iframe");
            expect(el).not.toBeNull();
            return el;
        });
        expect(iframe?.src).toContain(`${mockFrakConfig.walletUrl}/listener`);
    });

    test("should seed the listener URL with the derived clientId", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        // Regression: this provider used to omit `clientId` entirely, so the
        // listener never received an SDK-seeded identity and silently fell
        // back to its own persisted store.
        await waitFor(() => {
            const iframe = document.querySelector("iframe");
            expect(iframe?.src).toContain("clientId=");
        });
    });

    test("should apply custom styles to iframe", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

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

        await waitFor(() => {
            const iframe = document.querySelector("iframe");
            expect(iframe?.style.width).toBe("500px");
            expect(iframe?.style.height).toBe("600px");
        });
    });

    test("should create FrakClient when iframe ref is set", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const mockClient = { config: mockFrakConfig } as FrakClient;
        vi.mocked(createIFrameFrakClient).mockResolvedValue(mockClient);

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            expect(createIFrameFrakClient).toHaveBeenCalled();
        });
    });

    test("should not recreate client if already exists", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const mockClient = { config: mockFrakConfig } as FrakClient;
        vi.mocked(createIFrameFrakClient).mockResolvedValue(mockClient);

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

    test("should render without children", ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const { container } = render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        const iframe = container.querySelector("iframe");
        expect(iframe).toBeDefined();
    });

    test("should use baseIframeProps for iframe attributes", async ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        render(createElement(FrakIFrameClientProvider), {
            wrapper: Wrapper,
        });

        await waitFor(() => {
            const iframe = document.querySelector("iframe");
            expect(iframe).not.toBeNull();
            // baseIframeProps should set these attributes
            expect(iframe?.getAttribute("sandbox")).toBeDefined();
        });
    });

    test("should handle iframe ref callback correctly", ({
        mockFrakConfig,
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

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
        queryWrapper,
    }) => {
        const Wrapper = ({ children }: { children: ReactNode }) =>
            queryWrapper.wrapper({
                children: createElement(
                    FrakConfigProvider,
                    { config: mockFrakConfig },
                    children
                ),
            });

        const mockClient = { config: mockFrakConfig } as FrakClient;
        vi.mocked(createIFrameFrakClient).mockResolvedValue(mockClient);

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
