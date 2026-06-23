import { renderHook } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import type { StoreApi } from "zustand/vanilla";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { usePersistentPairingClient } from "./usePersistentPairingClient";

type MockSessionState = {
    webauthnSession: { address: `0x${string}` } | null;
    distantWebauthnSession: { address: `0x${string}` } | null;
};

// Mock dependencies
vi.mock("../../stores/sessionStore", async () => {
    const { createStore } = await import("zustand/vanilla");
    return {
        sessionStore: createStore<MockSessionState>(() => ({
            webauthnSession: null,
            distantWebauthnSession: null,
        })),
        selectWebauthnSession: vi.fn(
            (state: MockSessionState) => state.webauthnSession
        ),
        selectDistantWebauthnSession: vi.fn(
            (state: MockSessionState) => state.distantWebauthnSession
        ),
    };
});

vi.mock("../clients/store", () => ({
    getOriginPairingClient: vi.fn(),
    getTargetPairingClient: vi.fn(),
}));

describe("usePersistentPairingClient", () => {
    let mockSessionState: MockSessionState;
    let mockOriginClient: { reconnect: ReturnType<typeof vi.fn> };
    let mockTargetClient: { reconnect: ReturnType<typeof vi.fn> };

    beforeEach(async () => {
        vi.clearAllMocks();

        // `vi.mock` swaps `sessionStore` for a vanilla store typed against
        // `MockSessionState`, but TypeScript resolves the import against the
        // real `SessionStore` type. Cast through the mock shape so
        // `setState`/`getState` stay typed.
        const { sessionStore } = (await import(
            "../../stores/sessionStore"
        )) as unknown as { sessionStore: StoreApi<MockSessionState> };
        sessionStore.setState(
            { webauthnSession: null, distantWebauthnSession: null },
            true
        );
        mockSessionState = new Proxy({} as MockSessionState, {
            get: (_, key) =>
                sessionStore.getState()[key as keyof MockSessionState],
            set: (_, key, value) => {
                sessionStore.setState({
                    [key as keyof MockSessionState]: value,
                });
                return true;
            },
        });

        // Setup mock pairing clients
        mockOriginClient = {
            reconnect: vi.fn(),
        };
        mockTargetClient = {
            reconnect: vi.fn(),
        };

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

    describe("visibility-based reconnect (foreground resume)", () => {
        beforeEach(() => {
            vi.useFakeTimers();
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        test("should reconnect target client when app comes to foreground with webauthn session", () => {
            mockSessionState.webauthnSession = {
                address:
                    "0x1234567890123456789012345678901234567890" as `0x${string}`,
            };

            renderHook(() => usePersistentPairingClient());

            // Reset call count from initial mount
            mockTargetClient.reconnect.mockClear();

            // Simulate app coming to foreground
            Object.defineProperty(document, "visibilityState", {
                value: "visible",
                writable: true,
                configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));

            // Should not reconnect immediately (300ms delay)
            expect(mockTargetClient.reconnect).not.toHaveBeenCalled();

            // Advance past the 300ms delay
            vi.advanceTimersByTime(300);

            expect(mockTargetClient.reconnect).toHaveBeenCalledTimes(1);
            expect(mockOriginClient.reconnect).not.toHaveBeenCalled();
        });

        test("should reconnect origin client when app comes to foreground with distant-webauthn session", () => {
            mockSessionState.distantWebauthnSession = {
                address:
                    "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as `0x${string}`,
            };

            renderHook(() => usePersistentPairingClient());

            // Reset call count from initial mount
            mockOriginClient.reconnect.mockClear();

            // Simulate app coming to foreground
            Object.defineProperty(document, "visibilityState", {
                value: "visible",
                writable: true,
                configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));

            vi.advanceTimersByTime(300);

            expect(mockOriginClient.reconnect).toHaveBeenCalledTimes(1);
            expect(mockTargetClient.reconnect).not.toHaveBeenCalled();
        });

        test("should not reconnect when app goes to background", () => {
            mockSessionState.webauthnSession = {
                address:
                    "0x1234567890123456789012345678901234567890" as `0x${string}`,
            };

            renderHook(() => usePersistentPairingClient());
            mockTargetClient.reconnect.mockClear();

            // Simulate app going to background
            Object.defineProperty(document, "visibilityState", {
                value: "hidden",
                writable: true,
                configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));

            vi.advanceTimersByTime(500);

            expect(mockTargetClient.reconnect).not.toHaveBeenCalled();
        });

        test("should not register visibility listener when no session exists", () => {
            const addListenerSpy = vi.spyOn(document, "addEventListener");

            renderHook(() => usePersistentPairingClient());

            // Should not register visibilitychange listener
            const visibilityCalls = addListenerSpy.mock.calls.filter(
                ([event]) => event === "visibilitychange"
            );
            expect(visibilityCalls).toHaveLength(0);

            addListenerSpy.mockRestore();
        });

        test("should clean up visibility listener on unmount", () => {
            mockSessionState.webauthnSession = {
                address:
                    "0x1234567890123456789012345678901234567890" as `0x${string}`,
            };

            const removeListenerSpy = vi.spyOn(document, "removeEventListener");

            const { unmount } = renderHook(() => usePersistentPairingClient());

            unmount();

            const visibilityCalls = removeListenerSpy.mock.calls.filter(
                ([event]) => event === "visibilitychange"
            );
            expect(visibilityCalls).toHaveLength(1);

            removeListenerSpy.mockRestore();
        });

        test("should cancel pending reconnect timer on unmount", () => {
            mockSessionState.webauthnSession = {
                address:
                    "0x1234567890123456789012345678901234567890" as `0x${string}`,
            };

            const { unmount } = renderHook(() => usePersistentPairingClient());
            mockTargetClient.reconnect.mockClear();

            // Trigger visibility change
            Object.defineProperty(document, "visibilityState", {
                value: "visible",
                writable: true,
                configurable: true,
            });
            document.dispatchEvent(new Event("visibilitychange"));

            // Unmount before timer fires
            unmount();

            // Advance timer — should NOT call reconnect
            vi.advanceTimersByTime(500);

            expect(mockTargetClient.reconnect).not.toHaveBeenCalled();
        });
    });
});
