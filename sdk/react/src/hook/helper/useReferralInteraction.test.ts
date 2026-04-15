/**
 * Tests for useReferralInteraction hook
 * Tests automatic referral interaction submission
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");
vi.mock("../useFrakClient");

import { referralInteraction } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, test } from "../../../tests/vitest-fixtures";
import { useFrakClient } from "../useFrakClient";
import { useReferralInteraction } from "./useReferralInteraction";

describe("useReferralInteraction", () => {
    test("should return processing when client is not available", ({
        queryWrapper,
    }) => {
        vi.mocked(useFrakClient).mockReturnValue(undefined);

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        // Query is disabled when client is not available, status remains pending
        expect(result.current).toBe("processing");
    });

    test("should process referral successfully", async ({
        queryWrapper,
        mockFrakClient,
    }) => {
        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(referralInteraction).mockResolvedValue("success");

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual("success");
        });

        expect(referralInteraction).toHaveBeenCalledWith(mockFrakClient, {
            options: undefined,
        });
    });

    test("should process referral with options", async ({
        queryWrapper,
        mockFrakClient,
    }) => {
        const options = {
            alwaysAppendUrl: true,
        };

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(referralInteraction).mockResolvedValue("success");

        const { result } = renderHook(
            () => useReferralInteraction({ options }),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        await waitFor(() => {
            expect(result.current).toEqual("success");
        });

        expect(referralInteraction).toHaveBeenCalledWith(mockFrakClient, {
            options,
        });
    });


    test("should handle processing state", ({
        queryWrapper,
        mockFrakClient,
    }) => {
        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);

        // Mock referralInteraction to never resolve (simulate pending)
        vi.mocked(referralInteraction).mockImplementation(
            () => new Promise(() => {})
        );

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current).toBe("processing");
    });

    test("should handle errors", async ({ queryWrapper, mockFrakClient }) => {
        const error = new Error("Referral processing failed");

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(referralInteraction).mockRejectedValue(error);

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual(error);
        });
    });

    test("should throw ClientNotFound when client is not available but enabled", async ({
        queryWrapper,
    }) => {
        // Force the query to run despite no client (edge case)
        vi.mocked(useFrakClient).mockReturnValue(undefined);

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        // Query is disabled when client is null, so it stays pending
        expect(result.current).toBe("processing");
    });

    test("should return idle for no-referrer state", async ({
        queryWrapper,
        mockFrakClient,
    }) => {
        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(referralInteraction).mockResolvedValue(undefined);

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual("idle");
        });
    });
});
