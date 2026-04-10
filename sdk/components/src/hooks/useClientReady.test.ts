import { sdkConfigStore } from "@frak-labs/core-sdk";
import { renderHook, waitFor } from "@testing-library/preact";
import { act } from "preact/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as clientReadyUtils from "@/utils/clientReady";
import { useClientReady } from "./useClientReady";

vi.mock("@/utils/clientReady", async () => {
    const actual = await vi.importActual<typeof import("@/utils/clientReady")>(
        "@/utils/clientReady"
    );
    return {
        ...actual,
        onClientReady: vi.fn((action, callback) => {
            if (window.FrakSetup?.client && action === "add") {
                callback();
            } else if (action === "add") {
                window.addEventListener("frak:client", callback, false);
            } else {
                window.removeEventListener("frak:client", callback, false);
            }
        }),
    };
});

// Sequential: tests mutate module-level state (sdkConfigStore singleton +
// window.FrakSetup), which is incompatible with the workspace default of
// `sequence.concurrent: true`.
describe.sequential("useClientReady", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sdkConfigStore.setConfig({
            isResolved: true,
            merchantId: "test-merchant",
        });
        window.FrakSetup = {
            ...window.FrakSetup,
            client: {
                config: {
                    metadata: {
                        name: "Test App",
                        currency: "eur",
                    },
                },
            } as any,
        };
    });

    describe("shouldRender", () => {
        it("should be true when config is resolved", () => {
            const { result } = renderHook(() => useClientReady());
            expect(result.current.shouldRender).toBe(true);
        });

        it("should be false when config is not resolved and waitForBackendConfig is true", () => {
            sdkConfigStore.setConfig({
                isResolved: false,
                merchantId: "",
            });
            const { result } = renderHook(() => useClientReady());
            expect(result.current.shouldRender).toBe(false);
        });

        it("should be true when waitForBackendConfig is false regardless of config state", () => {
            sdkConfigStore.setConfig({
                isResolved: false,
                merchantId: "",
            });
            window.FrakSetup.config = {
                ...window.FrakSetup.config,
                waitForBackendConfig: false,
            } as any;

            const { result } = renderHook(() => useClientReady());
            expect(result.current.shouldRender).toBe(true);
        });

        it("should become true when frak:config event fires with resolved config", async () => {
            sdkConfigStore.setConfig({
                isResolved: false,
                merchantId: "",
            });
            const { result } = renderHook(() => useClientReady());
            expect(result.current.shouldRender).toBe(false);

            act(() => {
                window.dispatchEvent(
                    new CustomEvent("frak:config", {
                        detail: { isResolved: true, merchantId: "test" },
                    })
                );
            });

            await waitFor(() => {
                expect(result.current.shouldRender).toBe(true);
            });
        });
    });

    describe("isClientReady", () => {
        it("should be false when client is not set", () => {
            window.FrakSetup.client = undefined;
            const { result } = renderHook(() => useClientReady());
            expect(result.current.isClientReady).toBe(false);
        });

        it("should be true when client already exists", () => {
            const { result } = renderHook(() => useClientReady());
            expect(result.current.isClientReady).toBe(true);
        });

        it("should become true when frak:client event fires", async () => {
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

            act(() => {
                callback?.();
            });

            await waitFor(() => {
                expect(result.current.isClientReady).toBe(true);
            });
        });
    });

    describe("isHidden", () => {
        it("should be false by default", () => {
            const { result } = renderHook(() => useClientReady());
            expect(result.current.isHidden).toBe(false);
        });

        it("should be true when config has hidden flag", () => {
            sdkConfigStore.setConfig({
                isResolved: true,
                merchantId: "test-merchant",
                hidden: true,
            });

            const { result } = renderHook(() => useClientReady());
            expect(result.current.isHidden).toBe(true);
        });

        it("should update when frak:config event changes hidden", async () => {
            const { result } = renderHook(() => useClientReady());
            expect(result.current.isHidden).toBe(false);

            act(() => {
                window.dispatchEvent(
                    new CustomEvent("frak:config", {
                        detail: {
                            isResolved: true,
                            merchantId: "test",
                            hidden: true,
                        },
                    })
                );
            });

            await waitFor(() => {
                expect(result.current.isHidden).toBe(true);
            });
        });
    });

    describe("lifecycle", () => {
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
    });
});
