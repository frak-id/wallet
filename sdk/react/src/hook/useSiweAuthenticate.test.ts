import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");

import type { SiweAuthenticateReturnType } from "@frak-labs/core-sdk";
import { siweAuthenticate } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { useSiweAuthenticate } from "./useSiweAuthenticate";

describe("useSiweAuthenticate", () => {
    test("should throw ClientNotFound when client is not available", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useSiweAuthenticate(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.mutate).toBeDefined();
        });

        result.current.mutate({
            siwe: {
                domain: "example.com",
                uri: "https://example.com",
            },
        });

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeInstanceOf(ClientNotFound);
    });

    test("should authenticate with SIWE successfully", async ({
        mockFrakProviders,
    }) => {
        const mockResult: SiweAuthenticateReturnType = {
            signature: "0xsignature123",
            message: "Example message to sign",
        };

        vi.mocked(siweAuthenticate).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSiweAuthenticate(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            siwe: {
                domain: "example.com",
                uri: "https://example.com",
            },
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
        expect(siweAuthenticate).toHaveBeenCalledTimes(1);
    });

    test("should authenticate with custom SIWE params", async ({
        mockFrakProviders,
    }) => {
        const mockResult: SiweAuthenticateReturnType = {
            signature: "0xsignature456",
            message: "Custom message",
        };

        vi.mocked(siweAuthenticate).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSiweAuthenticate(), {
            wrapper: mockFrakProviders,
        });

        const siweParams = {
            domain: "custom.com",
            uri: "https://custom.com/auth",
            statement: "Sign in to Custom App",
            nonce: "random-nonce-123",
        };

        result.current.mutate({
            siwe: siweParams,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
        expect(siweAuthenticate).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                siwe: siweParams,
            })
        );
    });

    test("should authenticate with metadata", async ({ mockFrakProviders }) => {
        const mockResult: SiweAuthenticateReturnType = {
            signature: "0xsignature789",
            message: "Message with metadata",
        };

        vi.mocked(siweAuthenticate).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useSiweAuthenticate(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({
            siwe: {
                domain: "example.com",
                uri: "https://example.com",
            },
            metadata: {
                header: {
                    title: "Sign In with Ethereum",
                },
            },
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(result.current.data).toEqual(mockResult);
    });
});
