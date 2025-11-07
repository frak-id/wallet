import * as coreSdk from "@frak-labs/core-sdk";
import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as setupUtils from "@/utils/setup";
import { useShareModal } from "./useShareModal";

// Mock setup utils
vi.mock("@/utils/setup", () => ({
    getModalBuilderSteps: vi.fn(),
}));

describe("useShareModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default modal builder mock
        const mockModalBuilder = {
            sharing: vi.fn().mockReturnValue({
                display: vi.fn().mockResolvedValue(undefined),
            }),
        };
        vi.mocked(setupUtils.getModalBuilderSteps).mockReturnValue(
            mockModalBuilder as any
        );
    });

    it("should return initial state", () => {
        const { result } = renderHook(() => useShareModal());

        expect(result.current.isError).toBe(false);
        expect(result.current.debugInfo).toBeUndefined();
        expect(result.current.handleShare).toBeDefined();
    });

    it("should successfully open share modal", async () => {
        const mockDisplay = vi.fn().mockResolvedValue(undefined);
        const mockSharing = vi.fn().mockReturnValue({
            display: mockDisplay,
        });
        vi.mocked(setupUtils.getModalBuilderSteps).mockReturnValue({
            sharing: mockSharing,
        } as any);

        const { result } = renderHook(() => useShareModal());

        await result.current.handleShare();

        expect(mockSharing).toHaveBeenCalledWith(
            window.FrakSetup.modalShareConfig ?? {}
        );
        // display receives a function that transforms metadata
        expect(mockDisplay).toHaveBeenCalledWith(expect.any(Function));
        // Call the function to verify it returns correct metadata
        const transformFn = mockDisplay.mock.calls[0][0];
        const resultMetadata = transformFn({});
        expect(resultMetadata).toEqual({
            targetInteraction: undefined,
        });
    });

    it("should pass targetInteraction to display", async () => {
        const mockDisplay = vi.fn().mockResolvedValue(undefined);
        const mockSharing = vi.fn().mockReturnValue({
            display: mockDisplay,
        });
        vi.mocked(setupUtils.getModalBuilderSteps).mockReturnValue({
            sharing: mockSharing,
        } as any);

        const { result } = renderHook(() =>
            useShareModal("retail.customerMeeting")
        );

        await result.current.handleShare();

        // display receives a function that transforms metadata
        expect(mockDisplay).toHaveBeenCalledWith(expect.any(Function));
        // Call the function to verify it returns correct metadata
        const transformFn = mockDisplay.mock.calls[0][0];
        const resultMetadata = transformFn({});
        expect(resultMetadata).toEqual({
            targetInteraction: "retail.customerMeeting",
        });
    });

    it("should handle error when client is not found", async () => {
        const originalClient = window.FrakSetup.client;
        window.FrakSetup.client = undefined;

        const { result } = renderHook(() => useShareModal());

        await result.current.handleShare();

        // Wait for state update
        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.debugInfo).toContain("Frak client not found");

        // Restore client
        window.FrakSetup.client = originalClient;
    });

    it("should handle FrakRpcError with clientAborted code", async () => {
        const mockDisplay = vi
            .fn()
            .mockRejectedValue(
                new FrakRpcError(RpcErrorCodes.clientAborted, "User aborted")
            );
        const mockSharing = vi.fn().mockReturnValue({
            display: mockDisplay,
        });
        vi.mocked(setupUtils.getModalBuilderSteps).mockReturnValue({
            sharing: mockSharing,
        } as any);

        const { result } = renderHook(() => useShareModal());

        await result.current.handleShare();

        // Should not set error state for client abort
        expect(result.current.isError).toBe(false);
    });

    it("should handle other errors and set error state", async () => {
        const error = new Error("Modal error");
        const mockDisplay = vi.fn().mockRejectedValue(error);
        const mockSharing = vi.fn().mockReturnValue({
            display: mockDisplay,
        });
        vi.mocked(setupUtils.getModalBuilderSteps).mockReturnValue({
            sharing: mockSharing,
        } as any);

        const { result } = renderHook(() => useShareModal());

        await result.current.handleShare();

        // Wait for state update
        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(result.current.debugInfo).toBeDefined();
        expect(coreSdk.trackEvent).toHaveBeenCalledWith(
            window.FrakSetup.client,
            "share_modal_error",
            expect.objectContaining({
                error: "Modal error",
            })
        );
    });

    it("should handle error when modalBuilderSteps is not found", async () => {
        vi.mocked(setupUtils.getModalBuilderSteps).mockImplementation(() => {
            throw new Error("modalBuilderSteps not found");
        });

        const { result } = renderHook(() => useShareModal());

        await expect(result.current.handleShare()).rejects.toThrow(
            "modalBuilderSteps not found"
        );
    });

    it("should handle error when modalBuilderSteps returns null", async () => {
        // This tests the line 35 check: if (!modalBuilderSteps)
        vi.mocked(setupUtils.getModalBuilderSteps).mockReturnValue(null as any);

        const { result } = renderHook(() => useShareModal());

        await expect(result.current.handleShare()).rejects.toThrow(
            "modalBuilderSteps not found"
        );
    });
});
