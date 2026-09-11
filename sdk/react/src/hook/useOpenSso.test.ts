import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");

import type { OpenSsoReturnType } from "@frak-labs/core-sdk";
import { openSso } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "../../tests/vitest-fixtures";
import { useOpenSso } from "./useOpenSso";

describe("useOpenSso", () => {
    test("should throw ClientNotFound when client is not available", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useOpenSso(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current.mutate).toBeDefined();
        });

        result.current.mutate({});

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.error).toBeInstanceOf(ClientNotFound);
    });

    test("should open SSO successfully", async ({ mockFrakProviders }) => {
        const mockResult = undefined as unknown as OpenSsoReturnType;

        vi.mocked(openSso).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useOpenSso(), {
            wrapper: mockFrakProviders,
        });

        result.current.mutate({});

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(openSso).toHaveBeenCalledTimes(1);
    });

    test("should open SSO with redirectUrl", async ({ mockFrakProviders }) => {
        const mockResult = undefined as unknown as OpenSsoReturnType;

        vi.mocked(openSso).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useOpenSso(), {
            wrapper: mockFrakProviders,
        });

        const redirectUrl = "https://example.com/callback";

        result.current.mutate({
            redirectUrl,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(openSso).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                redirectUrl,
            })
        );
    });

    test("should open SSO with metadata", async ({ mockFrakProviders }) => {
        const mockResult = undefined as unknown as OpenSsoReturnType;

        vi.mocked(openSso).mockResolvedValue(mockResult);

        const { result } = renderHook(() => useOpenSso(), {
            wrapper: mockFrakProviders,
        });

        const metadata = {
            logoUrl: "https://example.com/logo.png",
            homepageLink: "https://example.com",
        };

        result.current.mutate({
            metadata,
            directExit: true,
        });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(openSso).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                metadata,
                directExit: true,
            })
        );
    });
});
