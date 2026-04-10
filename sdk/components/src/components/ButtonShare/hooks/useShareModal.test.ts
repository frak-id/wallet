import * as coreSdk from "@frak-labs/core-sdk";
import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useShareModal } from "./useShareModal";

// Sequential: tests mutate vi.mock state for shared modules and
// window.FrakSetup.client, incompatible with concurrent execution.
describe.sequential("useShareModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup default modalBuilder mock
        const mockDisplay = vi.fn().mockResolvedValue(undefined);
        const mockSharing = vi.fn().mockReturnValue({
            display: mockDisplay,
        });
        vi.mocked(coreSdkActions.modalBuilder).mockReturnValue({
            sharing: mockSharing,
        } as any);
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
        vi.mocked(coreSdkActions.modalBuilder).mockReturnValue({
            sharing: mockSharing,
        } as any);

        const { result } = renderHook(() => useShareModal());

        await result.current.handleShare();

        expect(coreSdkActions.modalBuilder).toHaveBeenCalledWith(
            window.FrakSetup.client,
            {}
        );
        expect(mockSharing).toHaveBeenCalledWith({});
        // display receives a function that transforms metadata, and placement
        expect(mockDisplay).toHaveBeenCalledWith(
            expect.any(Function),
            undefined
        );
        // Call the function to verify it returns correct metadata
        const transformFn = mockDisplay.mock.calls[0][0];
        const resultMetadata = transformFn({});
        expect(resultMetadata).toEqual({
            targetInteraction: undefined,
        });
    });

    it("should pass targetInteraction and placement to display", async () => {
        const mockDisplay = vi.fn().mockResolvedValue(undefined);
        const mockSharing = vi.fn().mockReturnValue({
            display: mockDisplay,
        });
        vi.mocked(coreSdkActions.modalBuilder).mockReturnValue({
            sharing: mockSharing,
        } as any);

        const { result } = renderHook(() =>
            useShareModal("custom.customerMeeting", "hero-section")
        );

        await result.current.handleShare();

        // display receives a function that transforms metadata, and placement
        expect(mockDisplay).toHaveBeenCalledWith(
            expect.any(Function),
            "hero-section"
        );
        // Call the function to verify it returns correct metadata
        const transformFn = mockDisplay.mock.calls[0][0];
        const resultMetadata = transformFn({});
        expect(resultMetadata).toEqual({
            targetInteraction: "custom.customerMeeting",
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
        vi.mocked(coreSdkActions.modalBuilder).mockReturnValue({
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
        vi.mocked(coreSdkActions.modalBuilder).mockReturnValue({
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
});
