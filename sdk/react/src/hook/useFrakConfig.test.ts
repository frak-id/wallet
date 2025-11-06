/**
 * Tests for useFrakConfig hook
 * Tests that the hook correctly retrieves the FrakConfig from context
 * and throws error when used outside provider
 */

import { FrakRpcError } from "@frak-labs/frame-connector";
import { renderHook } from "@testing-library/react";
import React from "react";
import { describe, expect, test, vi } from "../../tests/vitest-fixtures";
import { FrakConfigProvider } from "../provider/FrakConfigProvider";
import { useFrakConfig } from "./useFrakConfig";

describe("useFrakConfig", () => {
    test("should throw FrakRpcError when used outside provider", () => {
        // Mock console.error to avoid noise in test output
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => {});

        expect(() => {
            renderHook(() => useFrakConfig());
        }).toThrow(FrakRpcError);

        try {
            renderHook(() => useFrakConfig());
        } catch (error) {
            expect(error).toBeInstanceOf(FrakRpcError);
            // FrakRpcError message contains the error code
            expect((error as FrakRpcError).message).toContain("-32002");
        }

        consoleErrorSpy.mockRestore();
    });

    test("should return config when used inside provider", ({
        mockFrakConfig,
    }) => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const { result } = renderHook(() => useFrakConfig(), {
            wrapper,
        });

        expect(result.current).toBeDefined();
        expect(result.current.domain).toBe(mockFrakConfig.domain);
        expect(result.current.metadata?.name).toBe(
            mockFrakConfig.metadata?.name
        );
    });

    test("should apply default walletUrl if not provided", () => {
        const configWithoutWalletUrl = {
            domain: "example.com",
            metadata: {
                name: "Test App",
            },
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                FrakConfigProvider,
                { config: configWithoutWalletUrl },
                children
            );

        const { result } = renderHook(() => useFrakConfig(), {
            wrapper,
        });

        expect(result.current.walletUrl).toBe("https://wallet.frak.id");
    });

    test("should use provided walletUrl if specified", ({ mockFrakConfig }) => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const { result } = renderHook(() => useFrakConfig(), {
            wrapper,
        });

        expect(result.current.walletUrl).toBe(mockFrakConfig.walletUrl);
    });

    test("should return stable config across re-renders", ({
        mockFrakConfig,
    }) => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const { result, rerender } = renderHook(() => useFrakConfig(), {
            wrapper,
        });

        const firstConfig = result.current;
        rerender();
        const secondConfig = result.current;

        // Config values should remain stable
        expect(firstConfig.domain).toBe(secondConfig.domain);
        expect(firstConfig.walletUrl).toBe(secondConfig.walletUrl);
        expect(firstConfig.domain).toBe(mockFrakConfig.domain);
    });

    test("should include all config properties", ({ mockFrakConfig }) => {
        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                FrakConfigProvider,
                { config: mockFrakConfig },
                children
            );

        const { result } = renderHook(() => useFrakConfig(), {
            wrapper,
        });

        expect(result.current.domain).toBe(mockFrakConfig.domain);
        expect(result.current.walletUrl).toBe(mockFrakConfig.walletUrl);
        expect(result.current.metadata).toEqual(mockFrakConfig.metadata);
        expect(result.current.customizations).toEqual(
            mockFrakConfig.customizations
        );
    });

    test("should handle minimal config", () => {
        const minimalConfig = {
            domain: "minimal.com",
            metadata: {
                name: "Minimal Test App",
            },
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                FrakConfigProvider,
                { config: minimalConfig },
                children
            );

        const { result } = renderHook(() => useFrakConfig(), {
            wrapper,
        });

        expect(result.current.domain).toBe("minimal.com");
        expect(result.current.walletUrl).toBe("https://wallet.frak.id");
        expect(result.current.metadata.name).toBe("Minimal Test App");
        expect(result.current.customizations).toBeUndefined();
    });

    test("should fallback to window.location.host if domain not provided", () => {
        const configWithoutDomain = {
            metadata: {
                name: "Test App",
            },
        };

        const wrapper = ({ children }: { children: React.ReactNode }) =>
            React.createElement(
                FrakConfigProvider,
                { config: configWithoutDomain as any },
                children
            );

        const { result } = renderHook(() => useFrakConfig(), {
            wrapper,
        });

        // In test environment, window.location.host is "localhost"
        expect(result.current.domain).toBe("localhost");
    });
});
