import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import type { TargetPairingClient } from "../clients/target";
import type { TargetPairingPendingSignature } from "../types";
import {
    useDeclineSignatureRequest,
    useSignSignatureRequest,
} from "./useSignSignatureRequest";

vi.mock("../../stores/sessionStore", () => ({
    sessionStore: vi.fn(),
    selectWebauthnSession: vi.fn(),
}));

vi.mock("../../wallet/smartWallet/signature", () => ({
    signHashViaWebAuthN: vi.fn(),
}));

describe("useSignSignatureRequest", () => {
    const mockClient: TargetPairingClient = {
        sendSignatureResponse: vi.fn(),
    } as any;

    const mockRequest: TargetPairingPendingSignature = {
        id: "request-123",
        request: "0xhash" as Address,
        pairingId: "pairing-123",
        from: "origin",
    };

    beforeEach(({ queryWrapper }) => {
        queryWrapper.client.clear();
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should throw error when no session is present", async ({
        queryWrapper,
    }) => {
        const { sessionStore } = await import("../../stores/sessionStore");

        vi.mocked(sessionStore).mockReturnValue(null);

        const { result } = renderHook(
            () => useSignSignatureRequest({ client: mockClient }),
            { wrapper: queryWrapper.wrapper }
        );

        await expect(result.current.mutateAsync(mockRequest)).rejects.toThrow(
            "No session found"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });
    });

    test("should sign and send signature response successfully", async ({
        queryWrapper,
        mockSession,
    }) => {
        const { sessionStore } = await import("../../stores/sessionStore");
        const { signHashViaWebAuthN } = await import(
            "../../wallet/smartWallet/signature"
        );

        const mockSignature = "0xsignature" as Address;

        vi.mocked(sessionStore).mockReturnValue(mockSession);
        vi.mocked(signHashViaWebAuthN).mockResolvedValue(mockSignature);

        const { result } = renderHook(
            () => useSignSignatureRequest({ client: mockClient }),
            { wrapper: queryWrapper.wrapper }
        );

        await result.current.mutateAsync(mockRequest);

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(signHashViaWebAuthN).toHaveBeenCalledWith({
            hash: mockRequest.request,
            wallet: mockSession,
        });
        expect(mockClient.sendSignatureResponse).toHaveBeenCalledWith(
            mockRequest.id,
            { signature: mockSignature }
        );
    });

    test("should send error response when signing fails", async ({
        queryWrapper,
        mockSession,
    }) => {
        const { sessionStore } = await import("../../stores/sessionStore");
        const { signHashViaWebAuthN } = await import(
            "../../wallet/smartWallet/signature"
        );

        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        const mockError = new Error("User cancelled");

        vi.mocked(sessionStore).mockReturnValue(mockSession);
        vi.mocked(signHashViaWebAuthN).mockRejectedValue(mockError);

        const { result } = renderHook(
            () => useSignSignatureRequest({ client: mockClient }),
            { wrapper: queryWrapper.wrapper }
        );

        await expect(result.current.mutateAsync(mockRequest)).rejects.toThrow(
            "User cancelled"
        );

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(mockClient.sendSignatureResponse).toHaveBeenCalledWith(
            mockRequest.id,
            { reason: "User cancelled" }
        );
        expect(consoleWarnSpy).toHaveBeenCalledWith(
            "Failed to sign signature request",
            mockError
        );

        consoleWarnSpy.mockRestore();
    });

    test("should handle unknown errors", async ({
        queryWrapper,
        mockSession,
    }) => {
        const { sessionStore } = await import("../../stores/sessionStore");
        const { signHashViaWebAuthN } = await import(
            "../../wallet/smartWallet/signature"
        );

        const consoleWarnSpy = vi
            .spyOn(console, "warn")
            .mockImplementation(() => {});

        vi.mocked(sessionStore).mockReturnValue(mockSession);
        vi.mocked(signHashViaWebAuthN).mockRejectedValue("String error");

        const { result } = renderHook(
            () => useSignSignatureRequest({ client: mockClient }),
            { wrapper: queryWrapper.wrapper }
        );

        await expect(
            result.current.mutateAsync(mockRequest)
        ).rejects.toBeDefined();

        await waitFor(() => {
            expect(result.current.isError).toBe(true);
        });

        expect(mockClient.sendSignatureResponse).toHaveBeenCalledWith(
            mockRequest.id,
            { reason: "Unknown error" }
        );

        consoleWarnSpy.mockRestore();
    });
});

describe("useDeclineSignatureRequest", () => {
    const mockClient: TargetPairingClient = {
        sendSignatureResponse: vi.fn(),
    } as any;

    const mockRequest: TargetPairingPendingSignature = {
        id: "request-456",
        request: "0xhash2" as Address,
        pairingId: "pairing-456",
        from: "origin",
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    test("should decline signature request", () => {
        const { result } = renderHook(() =>
            useDeclineSignatureRequest({ client: mockClient })
        );

        result.current(mockRequest);

        expect(mockClient.sendSignatureResponse).toHaveBeenCalledWith(
            mockRequest.id,
            { reason: "Declined" }
        );
    });

    test("should return stable callback reference", () => {
        const { result, rerender } = renderHook(() =>
            useDeclineSignatureRequest({ client: mockClient })
        );

        const callback1 = result.current;
        rerender();
        const callback2 = result.current;

        expect(callback1).toBe(callback2);
    });

    test("should handle multiple decline requests", () => {
        const { result } = renderHook(() =>
            useDeclineSignatureRequest({ client: mockClient })
        );

        const request1: TargetPairingPendingSignature = {
            id: "req-1",
            request: "0xhash1" as Address,
            pairingId: "pairing-1",
            from: "origin",
        };
        const request2: TargetPairingPendingSignature = {
            id: "req-2",
            request: "0xhash2" as Address,
            pairingId: "pairing-2",
            from: "origin",
        };

        result.current(request1);
        result.current(request2);

        expect(mockClient.sendSignatureResponse).toHaveBeenCalledTimes(2);
        expect(mockClient.sendSignatureResponse).toHaveBeenCalledWith("req-1", {
            reason: "Declined",
        });
        expect(mockClient.sendSignatureResponse).toHaveBeenCalledWith("req-2", {
            reason: "Declined",
        });
    });
});
