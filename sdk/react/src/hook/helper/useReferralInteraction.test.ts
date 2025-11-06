/**
 * Tests for useReferralInteraction hook
 * Tests automatic referral interaction submission
 */

import { vi } from "vitest";

vi.mock("@frak-labs/core-sdk/actions");
vi.mock("../useFrakClient");
vi.mock("../useWalletStatus");
vi.mock("../utils/useFrakContext");

import type { FrakContext, WalletStatusReturnType } from "@frak-labs/core-sdk";
import { processReferral } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import type { Hex } from "viem";
import { describe, expect, test } from "../../../tests/vitest-fixtures";
import { useFrakClient } from "../useFrakClient";
import { useWalletStatus } from "../useWalletStatus";
import { useFrakContext } from "../utils/useFrakContext";
import { useReferralInteraction } from "./useReferralInteraction";

describe("useReferralInteraction", () => {
    test("should return processing when wallet status is not available", ({
        queryWrapper,
        mockFrakClient,
    }) => {
        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: null,
            updateContext: vi.fn(),
        });
        vi.mocked(useWalletStatus).mockReturnValue({
            data: undefined,
            isSuccess: false,
            isPending: true,
        } as ReturnType<typeof useWalletStatus>);

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        // Query is disabled when wallet status is not available, status remains pending
        expect(result.current).toBe("processing");
    });

    test("should process referral successfully", async ({
        queryWrapper,
        mockFrakClient,
    }) => {
        const mockReferralState = "success";

        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        const mockFrakContext: FrakContext = {
            r: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: mockFrakContext,
            updateContext: vi.fn(),
        });
        vi.mocked(useWalletStatus).mockReturnValue({
            data: mockWalletStatus,
            isSuccess: true,
            isPending: false,
        } as ReturnType<typeof useWalletStatus>);
        vi.mocked(processReferral).mockResolvedValue(mockReferralState);

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual(mockReferralState);
        });

        expect(processReferral).toHaveBeenCalledWith(mockFrakClient, {
            walletStatus: mockWalletStatus,
            frakContext: mockFrakContext,
            modalConfig: undefined,
            productId: undefined,
            options: undefined,
        });
    });

    test("should process referral with productId", async ({
        queryWrapper,
        mockFrakClient,
    }) => {
        const mockReferralState = "success";

        const productId =
            "0x1234567890123456789012345678901234567890123456789012345678901234" as Hex;

        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: { r: "0x1234567890123456789012345678901234567890" },
            updateContext: vi.fn(),
        });
        vi.mocked(useWalletStatus).mockReturnValue({
            data: mockWalletStatus,
            isSuccess: true,
            isPending: false,
        } as ReturnType<typeof useWalletStatus>);
        vi.mocked(processReferral).mockResolvedValue(mockReferralState);

        const { result } = renderHook(
            () => useReferralInteraction({ productId }),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        await waitFor(() => {
            expect(result.current).toEqual(mockReferralState);
        });

        expect(processReferral).toHaveBeenCalledWith(
            mockFrakClient,
            expect.objectContaining({
                productId,
            })
        );
    });

    test("should process referral with modalConfig", async ({
        queryWrapper,
        mockFrakClient,
    }) => {
        const mockReferralState = "success";

        const modalConfig = {
            metadata: {
                logo: "https://example.com/logo.png",
            },
        };

        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: { r: "0x4567890123456789012345678901234567890123" },
            updateContext: vi.fn(),
        });
        vi.mocked(useWalletStatus).mockReturnValue({
            data: mockWalletStatus,
            isSuccess: true,
            isPending: false,
        } as ReturnType<typeof useWalletStatus>);
        vi.mocked(processReferral).mockResolvedValue(mockReferralState);

        const { result } = renderHook(
            () => useReferralInteraction({ modalConfig }),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        await waitFor(() => {
            expect(result.current).toEqual(mockReferralState);
        });

        expect(processReferral).toHaveBeenCalledWith(
            mockFrakClient,
            expect.objectContaining({
                modalConfig,
            })
        );
    });

    test("should process referral with options", async ({
        queryWrapper,
        mockFrakClient,
    }) => {
        const mockReferralState = "success";

        const options = {
            alwaysAppendUrl: true,
        };

        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: { r: "0x7890123456789012345678901234567890123456" },
            updateContext: vi.fn(),
        });
        vi.mocked(useWalletStatus).mockReturnValue({
            data: mockWalletStatus,
            isSuccess: true,
            isPending: false,
        } as ReturnType<typeof useWalletStatus>);
        vi.mocked(processReferral).mockResolvedValue(mockReferralState);

        const { result } = renderHook(
            () => useReferralInteraction({ options }),
            {
                wrapper: queryWrapper.wrapper,
            }
        );

        await waitFor(() => {
            expect(result.current).toEqual(mockReferralState);
        });

        expect(processReferral).toHaveBeenCalledWith(
            mockFrakClient,
            expect.objectContaining({
                options,
            })
        );
    });

    test("should handle processing state", ({
        queryWrapper,
        mockFrakClient,
    }) => {
        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: { r: "0x9999999999999999999999999999999999999999" },
            updateContext: vi.fn(),
        });
        vi.mocked(useWalletStatus).mockReturnValue({
            data: mockWalletStatus,
            isSuccess: true,
            isPending: false,
        } as ReturnType<typeof useWalletStatus>);

        // Mock processReferral to never resolve (simulate pending)
        vi.mocked(processReferral).mockImplementation(
            () => new Promise(() => {})
        );

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current).toBe("processing");
    });

    test("should handle errors", async ({ queryWrapper, mockFrakClient }) => {
        const error = new Error("Referral processing failed");

        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: { r: "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" },
            updateContext: vi.fn(),
        });
        vi.mocked(useWalletStatus).mockReturnValue({
            data: mockWalletStatus,
            isSuccess: true,
            isPending: false,
        } as ReturnType<typeof useWalletStatus>);
        vi.mocked(processReferral).mockRejectedValue(error);

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual(error);
        });
    });

    test("should throw ClientNotFound when client is not available", async ({
        queryWrapper,
    }) => {
        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useFrakClient).mockReturnValue(undefined);
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: { r: "0xcccccccccccccccccccccccccccccccccccccccc" },
            updateContext: vi.fn(),
        });
        vi.mocked(useWalletStatus).mockReturnValue({
            data: mockWalletStatus,
            isSuccess: true,
            isPending: false,
        } as ReturnType<typeof useWalletStatus>);

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toBeInstanceOf(ClientNotFound);
        });
    });

    test("should update query key when referrer changes", async ({
        queryWrapper,
        mockFrakClient,
    }) => {
        const mockReferralState = "success";

        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(useWalletStatus).mockReturnValue({
            data: mockWalletStatus,
            isSuccess: true,
            isPending: false,
        } as ReturnType<typeof useWalletStatus>);
        vi.mocked(processReferral).mockResolvedValue(mockReferralState);

        // Start with one referrer
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: { r: "0x1111111111111111111111111111111111111111" },
            updateContext: vi.fn(),
        });

        const { rerender } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(processReferral).toHaveBeenCalledTimes(1);
        });

        // Change referrer
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: { r: "0x2222222222222222222222222222222222222222" },
            updateContext: vi.fn(),
        });

        rerender();

        // Query should re-run with new referrer
        await waitFor(() => {
            expect(processReferral).toHaveBeenCalledTimes(2);
        });
    });

    test("should handle no referrer in context", async ({
        queryWrapper,
        mockFrakClient,
    }) => {
        const mockReferralState = "success";

        const mockWalletStatus: WalletStatusReturnType = {
            key: "connected",
            wallet: "0x1234567890123456789012345678901234567890",
        };

        vi.mocked(useFrakClient).mockReturnValue(mockFrakClient);
        vi.mocked(useFrakContext).mockReturnValue({
            frakContext: null, // No referrer
            updateContext: vi.fn(),
        });
        vi.mocked(useWalletStatus).mockReturnValue({
            data: mockWalletStatus,
            isSuccess: true,
            isPending: false,
        } as ReturnType<typeof useWalletStatus>);
        vi.mocked(processReferral).mockResolvedValue(mockReferralState);

        const { result } = renderHook(() => useReferralInteraction(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => {
            expect(result.current).toEqual(mockReferralState);
        });

        expect(processReferral).toHaveBeenCalledWith(
            mockFrakClient,
            expect.objectContaining({
                frakContext: null,
            })
        );
    });
});
