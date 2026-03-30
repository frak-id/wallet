import { sdkConfigStore } from "@frak-labs/core-sdk";
import { renderHook, waitFor } from "@testing-library/preact";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as clientReadyUtils from "@/utils/clientReady";
import { useClientReady } from "./useClientReady";

// Mock the clientReady utils - we need to preserve the actual implementation structure
vi.mock("@/utils/clientReady", async () => {
    const actual = await vi.importActual<typeof import("@/utils/clientReady")>(
        "@/utils/clientReady"
    );
    return {
        ...actual,
        onClientReady: vi.fn((action, callback) => {
            // If client exists and action is "add", call callback immediately
            if (window.FrakSetup?.client && action === "add") {
                callback();
            } else if (action === "add") {
                // Otherwise, add event listener
                window.addEventListener("frakClientReady", callback, false);
            } else {
                // Remove event listener
                window.removeEventListener("frakClientReady", callback, false);
            }
        }),
    };
});

describe("useClientReady", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mark the SDK config store as resolved so the hook can proceed
        sdkConfigStore.setConfig({
            isResolved: true,
            merchantId: "test-merchant",
        });
        // Reset window.FrakSetup.client
        window.FrakSetup.client = {
            config: {
                metadata: {
                    name: "Test App",
                    currency: "eur",
                },
            },
        } as any;
    });

    it("should return disabled state initially when client is not ready", () => {
        window.FrakSetup.client = undefined;
        const { result } = renderHook(() => useClientReady());

        expect(result.current.isClientReady).toBe(false);
        expect(result.current.isHidden).toBe(false);
    });

    it("should return enabled state when client is already ready", () => {
        window.FrakSetup.client = {
            config: {
                metadata: {
                    name: "Test App",
                    currency: "eur",
                },
            },
        } as any;

        const { result } = renderHook(() => useClientReady());

        expect(result.current.isClientReady).toBe(true);
        expect(result.current.isHidden).toBe(false);
    });

    it("should return isHidden true when config has hidden flag", () => {
        sdkConfigStore.setConfig({
            isResolved: true,
            merchantId: "test-merchant",
            hidden: true,
        });

        window.FrakSetup.client = {
            config: {
                metadata: {
                    name: "Test App",
                    currency: "eur",
                },
            },
        } as any;

        const { result } = renderHook(() => useClientReady());

        expect(result.current.isClientReady).toBe(true);
        expect(result.current.isHidden).toBe(true);
    });

    it("should subscribe to client ready event on mount", () => {
        window.FrakSetup.client = undefined;
        renderHook(() => useClientReady());

        expect(clientReadyUtils.onClientReady).toHaveBeenCalledWith(
            "add",
            expect.any(Function)
        );
    });

    it("should unsubscribe from client ready event on unmount", () => {
        window.FrakSetup.client = undefined;
        const { unmount } = renderHook(() => useClientReady());

        unmount();

        expect(clientReadyUtils.onClientReady).toHaveBeenCalledWith(
            "remove",
            expect.any(Function)
        );
    });

    it("should update state when client ready event is dispatched", async () => {
        window.FrakSetup.client = undefined;
        let callback: (() => void) | undefined;

        vi.mocked(clientReadyUtils.onClientReady).mockImplementation(
            (action, cb) => {
                if (action === "add") {
                    callback = cb;
                }
            }
        );

        const { result } = renderHook(() => useClientReady());

        expect(result.current.isClientReady).toBe(false);

        // Simulate client ready event
        if (callback) {
            callback();
        }

        await waitFor(() => {
            expect(result.current.isClientReady).toBe(true);
        });
    });
});
