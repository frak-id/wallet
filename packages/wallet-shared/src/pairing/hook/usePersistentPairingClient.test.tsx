import { renderHook } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { usePersistentPairingClient } from "./usePersistentPairingClient";

// Mock dependencies
vi.mock("../../stores/sessionStore", () => ({
    sessionStore: vi.fn(),
    selectWebauthnSession: vi.fn((state) => state.webauthnSession),
    selectDistantWebauthnSession: vi.fn(
        (state) => state.distantWebauthnSession
    ),
}));

vi.mock("../clients/store", () => ({
    getOriginPairingClient: vi.fn(),
    getTargetPairingClient: vi.fn(),
}));

describe("usePersistentPairingClient", () => {
    let mockSessionState: {
        webauthnSession: null | { address: `0x${string}` };
        distantWebauthnSession: null | { address: `0x${string}` };
    };
    let mockOriginClient: { reconnect: ReturnType<typeof vi.fn> };
    let mockTargetClient: { reconnect: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        vi.clearAllMocks();

        // Setup mock store state
        mockSessionState = {
            webauthnSession: null,
            distantWebauthnSession: null,
        };

        // Setup mock pairing clients
        mockOriginClient = {
            reconnect: vi.fn(),
        };
        mockTargetClient = {
            reconnect: vi.fn(),
        };

        const {
            sessionStore,
            selectWebauthnSession,
            selectDistantWebauthnSession,
        } = await import("../../stores/sessionStore");
        // Mock sessionStore to work with selectors
        vi.mocked(sessionStore).mockImplementation((selector: any) => {
            if (typeof selector === "function") {
                return selector(mockSessionState as any);
            }
            return mockSessionState;
        });
        vi.mocked(selectWebauthnSession).mockImplementation(
            (state: any) => state.webauthnSession
        );
        vi.mocked(selectDistantWebauthnSession).mockImplementation(
            (state: any) => state.distantWebauthnSession
        );

        const { getOriginPairingClient, getTargetPairingClient } = await import(
            "../clients/store"
        );
        vi.mocked(getOriginPairingClient).mockReturnValue(
            mockOriginClient as any
        );
        vi.mocked(getTargetPairingClient).mockReturnValue(
            mockTargetClient as any
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
        // Reset mock state
        mockSessionState.webauthnSession = null;
        mockSessionState.distantWebauthnSession = null;
    });

    test("should reconnect target client when webauthnSession exists", () => {
        mockSessionState.webauthnSession = {
            address:
                "0x1234567890123456789012345678901234567890" as `0x${string}`,
        };

        renderHook(() => usePersistentPairingClient());

        expect(mockTargetClient.reconnect).toHaveBeenCalledTimes(1);
        expect(mockOriginClient.reconnect).not.toHaveBeenCalled();
    });

    test("should reconnect origin client when distantWebauthnSession exists and webauthnSession is null", () => {
        mockSessionState.distantWebauthnSession = {
            address:
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        };

        renderHook(() => usePersistentPairingClient());

        expect(mockOriginClient.reconnect).toHaveBeenCalledTimes(1);
        expect(mockTargetClient.reconnect).not.toHaveBeenCalled();
    });

    test("should prioritize webauthnSession over distantWebauthnSession", () => {
        mockSessionState.webauthnSession = {
            address:
                "0x1234567890123456789012345678901234567890" as `0x${string}`,
        };
        mockSessionState.distantWebauthnSession = {
            address:
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        };

        renderHook(() => usePersistentPairingClient());

        // Should only call target client reconnect, not origin
        expect(mockTargetClient.reconnect).toHaveBeenCalledTimes(1);
        expect(mockOriginClient.reconnect).not.toHaveBeenCalled();
    });

    test("should not reconnect when both sessions are null", () => {
        renderHook(() => usePersistentPairingClient());

        expect(mockTargetClient.reconnect).not.toHaveBeenCalled();
        expect(mockOriginClient.reconnect).not.toHaveBeenCalled();
    });

    test("should not reconnect when webauthnSession exists but address is undefined", () => {
        mockSessionState.webauthnSession = {
            address: undefined as any,
        };

        renderHook(() => usePersistentPairingClient());

        expect(mockTargetClient.reconnect).not.toHaveBeenCalled();
        expect(mockOriginClient.reconnect).not.toHaveBeenCalled();
    });

    test("should not reconnect when distantWebauthnSession exists but address is undefined", () => {
        mockSessionState.distantWebauthnSession = {
            address: undefined as any,
        };

        renderHook(() => usePersistentPairingClient());

        expect(mockOriginClient.reconnect).not.toHaveBeenCalled();
        expect(mockTargetClient.reconnect).not.toHaveBeenCalled();
    });

    test("should reconnect when webauthnSession address changes", () => {
        const { rerender } = renderHook(() => usePersistentPairingClient());

        // Initially no session
        expect(mockTargetClient.reconnect).not.toHaveBeenCalled();

        // Update to have webauthnSession
        mockSessionState.webauthnSession = {
            address:
                "0x1234567890123456789012345678901234567890" as `0x${string}`,
        };
        rerender();

        expect(mockTargetClient.reconnect).toHaveBeenCalledTimes(1);
    });

    test("should reconnect when distantWebauthnSession address changes", () => {
        const { rerender } = renderHook(() => usePersistentPairingClient());

        // Initially no session
        expect(mockOriginClient.reconnect).not.toHaveBeenCalled();

        // Update to have distantWebauthnSession
        mockSessionState.distantWebauthnSession = {
            address:
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        };
        rerender();

        expect(mockOriginClient.reconnect).toHaveBeenCalledTimes(1);
    });

    test("should switch from origin to target when webauthnSession is added", () => {
        // Start with distantWebauthnSession
        mockSessionState.distantWebauthnSession = {
            address:
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
        };

        const { rerender } = renderHook(() => usePersistentPairingClient());

        expect(mockOriginClient.reconnect).toHaveBeenCalledTimes(1);
        expect(mockTargetClient.reconnect).not.toHaveBeenCalled();

        // Add webauthnSession (should switch to target)
        mockSessionState.webauthnSession = {
            address:
                "0x1234567890123456789012345678901234567890" as `0x${string}`,
        };
        rerender();

        // Should now call target reconnect
        expect(mockTargetClient.reconnect).toHaveBeenCalledTimes(1);
        // Origin should still only be called once (from initial render)
        expect(mockOriginClient.reconnect).toHaveBeenCalledTimes(1);
    });

    test("should call reconnect only once per session change", () => {
        mockSessionState.webauthnSession = {
            address:
                "0x1234567890123456789012345678901234567890" as `0x${string}`,
        };

        const { rerender } = renderHook(() => usePersistentPairingClient());

        // First render should call reconnect
        expect(mockTargetClient.reconnect).toHaveBeenCalledTimes(1);

        // Rerender with same session should not call again
        rerender();
        expect(mockTargetClient.reconnect).toHaveBeenCalledTimes(1);
    });
});
