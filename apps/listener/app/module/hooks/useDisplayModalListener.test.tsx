import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import { beforeEach, describe, expect, test } from "@/tests/fixtures";
import { useDisplayModalListener } from "./useDisplayModalListener";

// Mock modal store
const mockModalStore = {
    getState: vi.fn(() => ({
        steps: undefined,
        currentStep: 0,
        results: {},
        dismissed: false,
        setNewModal: vi.fn(),
        clearModal: vi.fn(),
    })),
    subscribe: vi.fn(() => vi.fn()),
};

// Mock wallet-shared stores (need to work as both hooks and objects)
const mockSessionStore: any = Object.assign(
    vi.fn((selector: any) => {
        const state = { session: undefined };
        return selector(state);
    }),
    {
        getState: vi.fn(() => ({ session: undefined })),
    }
);

const mockWalletStore: any = Object.assign(
    vi.fn((selector: any) => {
        const state = { interactionSession: undefined };
        return selector(state);
    }),
    {
        getState: vi.fn(() => ({ interactionSession: undefined })),
    }
);

const mockTrackGenericEvent = vi.fn();

vi.mock("@frak-labs/wallet-shared", () => ({
    get sessionStore() {
        return mockSessionStore;
    },
    get walletStore() {
        return mockWalletStore;
    },
    get trackGenericEvent() {
        return mockTrackGenericEvent;
    },
}));

vi.mock("@/module/stores/modalStore", () => ({
    get modalStore() {
        return mockModalStore;
    },
    selectShouldFinish: vi.fn((state: any) => {
        // Simulate completion detection
        if (state.results?.final) return state.results;
        return undefined;
    }),
}));

// Mock ListenerUI Provider
const mockSetRequest = vi.fn();

vi.mock("@/module/providers/ListenerUiProvider", () => ({
    useListenerUI: () => ({ setRequest: mockSetRequest }),
    ListenerUIProvider: ({ children }: { children: ReactNode }) => children,
}));

describe("useDisplayModalListener", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockModalStore.getState.mockReturnValue({
            steps: undefined,
            currentStep: 0,
            results: {},
            dismissed: false,
            setNewModal: vi.fn(),
            clearModal: vi.fn(),
        });
        mockSessionStore.getState.mockReturnValue({ session: undefined });
        mockWalletStore.getState.mockReturnValue({
            interactionSession: undefined,
        });
    });

    test("should throw error for empty steps", async ({ mockProductId }) => {
        const { result } = renderHook(() => useDisplayModalListener());

        const params = [{}, {}, {}] as any;
        const context = { productId: mockProductId };

        await expect(result.current(params, context as any)).rejects.toThrow(
            FrakRpcError
        );

        try {
            await result.current(params, context as any);
        } catch (error) {
            expect((error as FrakRpcError).code).toBe(
                RpcErrorCodes.invalidRequest
            );
            expect((error as FrakRpcError).message).toContain(
                "No modals to display"
            );
        }

        expect(mockModalStore.getState().clearModal).toHaveBeenCalled();
    });

    test("should prepare and sort steps by importance", async ({
        mockProductId,
    }) => {
        let subscribeCb: ((state: any) => void) | undefined;
        let stateSnapshot: any;

        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            final: { action: { key: "success" } },
            login: {},
            openSession: {},
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        // Start the promise but don't await yet
        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockModalStore.getState().setNewModal).toHaveBeenCalled();
        });

        // Get the setNewModal call arguments
        const setNewModalCall = (mockModalStore.getState().setNewModal as any)
            .mock.calls[0][0];
        stateSnapshot = setNewModalCall;

        // Steps should be sorted: login (-2) < openSession (-1) < final (100)
        expect(stateSnapshot.steps).toHaveLength(3);
        expect(stateSnapshot.steps[0].key).toBe("login");
        expect(stateSnapshot.steps[1].key).toBe("openSession");
        expect(stateSnapshot.steps[2].key).toBe("final");

        // Complete the modal to resolve promise
        if (subscribeCb) {
            subscribeCb({
                steps: stateSnapshot.steps,
                results: { final: { action: { key: "success" } } },
                dismissed: false,
            });
        }

        await promise.catch(() => {});
    });

    test("should skip login step if user is already authenticated", async ({
        mockAddress,
        mockProductId,
    }) => {
        mockSessionStore.getState.mockReturnValue({
            session: { address: mockAddress },
        });

        let subscribeCb: ((state: any) => void) | undefined;
        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            login: {},
            final: { action: { key: "success" } },
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockModalStore.getState().setNewModal).toHaveBeenCalled();
        });

        const setNewModalCall = (mockModalStore.getState().setNewModal as any)
            .mock.calls[0][0];

        // Should start at step 1 (skipping login)
        expect(setNewModalCall.currentStep).toBe(1);
        // Should have login result pre-filled
        expect(setNewModalCall.initialResult.login).toEqual({
            wallet: mockAddress,
        });

        // Complete the modal
        if (subscribeCb) {
            subscribeCb({
                steps: setNewModalCall.steps,
                results: { final: { action: { key: "success" } } },
                dismissed: false,
            });
        }

        await promise.catch(() => {});
    });

    test("should skip openSession step if user has active session", async ({
        mockAddress,
        mockProductId,
    }) => {
        const futureTime = Date.now() + 3600000;

        mockSessionStore.getState.mockReturnValue({
            session: { address: mockAddress },
        });
        mockWalletStore.getState.mockReturnValue({
            interactionSession: {
                sessionStart: Date.now(),
                sessionEnd: futureTime,
            },
        });

        let subscribeCb: ((state: any) => void) | undefined;
        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            login: {},
            openSession: {},
            final: { action: { key: "success" } },
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockModalStore.getState().setNewModal).toHaveBeenCalled();
        });

        const setNewModalCall = (mockModalStore.getState().setNewModal as any)
            .mock.calls[0][0];

        // Should start at step 2 (skipping login and openSession)
        expect(setNewModalCall.currentStep).toBe(2);
        // Should have both results pre-filled
        expect(setNewModalCall.initialResult.login).toBeDefined();
        expect(setNewModalCall.initialResult.openSession).toEqual({
            startTimestamp: expect.any(Number),
            endTimestamp: futureTime,
        });

        // Complete the modal
        if (subscribeCb) {
            subscribeCb({
                steps: setNewModalCall.steps,
                results: { final: { action: { key: "success" } } },
                dismissed: false,
            });
        }

        await promise.catch(() => {});
    });

    test("should not skip openSession if session is expired", async ({
        mockAddress,
        mockProductId,
    }) => {
        const pastTime = Date.now() - 1000;

        mockSessionStore.getState.mockReturnValue({
            session: { address: mockAddress },
        });
        mockWalletStore.getState.mockReturnValue({
            interactionSession: {
                sessionStart: Date.now() - 3600000,
                sessionEnd: pastTime,
            },
        });

        let subscribeCb: ((state: any) => void) | undefined;
        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            login: {},
            openSession: {},
            final: { action: { key: "success" } },
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockModalStore.getState().setNewModal).toHaveBeenCalled();
        });

        const setNewModalCall = (mockModalStore.getState().setNewModal as any)
            .mock.calls[0][0];

        // Should skip login but NOT openSession (expired)
        expect(setNewModalCall.currentStep).toBe(1);
        expect(setNewModalCall.initialResult.login).toBeDefined();
        expect(setNewModalCall.initialResult.openSession).toBeUndefined();

        // Complete the modal
        if (subscribeCb) {
            subscribeCb({
                steps: setNewModalCall.steps,
                results: { final: { action: { key: "success" } } },
                dismissed: false,
            });
        }

        await promise.catch(() => {});
    });

    test("should reject promise when modal is dismissed", async ({
        mockProductId,
    }) => {
        let subscribeCb: ((state: any) => void) | undefined;
        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            final: { action: { key: "success" } },
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockModalStore.subscribe).toHaveBeenCalled();
        });

        // Simulate dismissal
        if (subscribeCb) {
            subscribeCb({
                steps: [{ key: "final", params: steps.final }],
                dismissed: true,
                results: {},
            });
        }

        await expect(promise).rejects.toThrow(FrakRpcError);

        try {
            await promise;
        } catch (error) {
            expect((error as FrakRpcError).code).toBe(
                RpcErrorCodes.clientAborted
            );
            expect((error as FrakRpcError).message).toContain(
                "User dismissed the modal"
            );
        }
    });

    test("should resolve promise when modal is completed", async ({
        mockProductId,
    }) => {
        let subscribeCb: ((state: any) => void) | undefined;
        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const mockSelectShouldFinish = vi.mocked(
            await import("@/module/stores/modalStore")
        ).selectShouldFinish;

        const finalResult = {
            login: { wallet: "0xabc" as `0x${string}` },
            final: { action: { key: "success" } },
        } as any;
        mockSelectShouldFinish.mockReturnValue(finalResult);

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            final: { action: { key: "success" } },
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockModalStore.subscribe).toHaveBeenCalled();
        });

        // Simulate completion
        if (subscribeCb) {
            subscribeCb({
                steps: [{ key: "final", params: steps.final }],
                dismissed: false,
                results: finalResult,
            });
        }

        const result_value = await promise;
        expect(result_value).toEqual(finalResult);
    });

    test("should call setRequest with correct parameters", async ({
        mockProductId,
    }) => {
        let subscribeCb: ((state: any) => void) | undefined;
        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            final: { action: { key: "success" } },
        };
        const metadata = {
            header: { icon: "https://icon.url" },
            targetInteraction: "some-interaction",
        };
        const configMetadata = {
            name: "Test App",
            logoUrl: "https://logo.url",
            homepageLink: "https://homepage.url",
            lang: "en",
        };
        const params = [steps, metadata, configMetadata] as any;
        const context = { productId: "0x123" as `0x${string}` };

        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockSetRequest).toHaveBeenCalled();
        });

        const setRequestCall = mockSetRequest.mock.calls[0][0];
        expect(setRequestCall.type).toBe("modal");
        expect(setRequestCall.appName).toBe("Test App");
        expect(setRequestCall.logoUrl).toBe("https://icon.url");
        expect(setRequestCall.homepageLink).toBe("https://homepage.url");
        expect(setRequestCall.targetInteraction).toBe("some-interaction");
        expect(setRequestCall.i18n.lang).toBe("en");
        expect(setRequestCall.i18n.context).toBe("success");

        // Complete the modal
        if (subscribeCb) {
            subscribeCb({
                steps: [{ key: "final", params: steps.final }],
                results: { final: { action: { key: "success" } } },
                dismissed: false,
            });
        }

        await promise.catch(() => {});
    });

    test("should track modal display with correct step", async ({
        mockProductId,
    }) => {
        let subscribeCb: ((state: any) => void) | undefined;
        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            login: {},
            final: { action: { key: "redirect" } },
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockTrackGenericEvent).toHaveBeenCalledWith("open-modal", {
                step: "login",
            });
        });

        // Complete the modal
        if (subscribeCb) {
            subscribeCb({
                steps: [{ key: "login" }, { key: "final" }],
                results: { final: { action: { key: "success" } } },
                dismissed: false,
            });
        }

        await promise.catch(() => {});
    });

    test("should track final step with action key", async ({
        mockProductId,
    }) => {
        let subscribeCb: ((state: any) => void) | undefined;
        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            final: { action: { key: "redirect" } },
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockTrackGenericEvent).toHaveBeenCalledWith("open-modal", {
                step: "redirect",
            });
        });

        // Complete the modal
        if (subscribeCb) {
            subscribeCb({
                steps: [{ key: "final", params: steps.final }],
                results: { final: { action: { key: "success" } } },
                dismissed: false,
            });
        }

        await promise.catch(() => {});
    });

    test("should clean up previous subscription on new modal", async ({
        mockProductId,
    }) => {
        const mockUnsubscribe1 = vi.fn();
        const mockUnsubscribe2 = vi.fn();

        let subscribeCb1: ((state: any) => void) | undefined;
        let subscribeCb2: ((state: any) => void) | undefined;

        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                if (!subscribeCb1) {
                    subscribeCb1 = cb;
                    return mockUnsubscribe1;
                }
                subscribeCb2 = cb;
                return mockUnsubscribe2;
            }
        );

        const mockSelectShouldFinish = vi.mocked(
            await import("@/module/stores/modalStore")
        ).selectShouldFinish;

        const finalResult = {
            final: { action: { key: "success" } },
        } as any;
        mockSelectShouldFinish.mockReturnValue(finalResult);

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            final: { action: { key: "success" } },
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        // First modal
        const promise1 = result.current(params, context as any);

        await waitFor(() => {
            expect(mockModalStore.subscribe).toHaveBeenCalledTimes(1);
        });

        // Second modal (should clean up first)
        const promise2 = result.current(params, context as any);

        await waitFor(() => {
            expect(mockUnsubscribe1).toHaveBeenCalled();
        });

        // Complete both modals quickly
        if (subscribeCb1) {
            subscribeCb1({
                steps: [{ key: "final", params: steps.final }],
                results: finalResult,
                dismissed: false,
            });
        }
        if (subscribeCb2) {
            subscribeCb2({
                steps: [{ key: "final", params: steps.final }],
                results: finalResult,
                dismissed: false,
            });
        }

        await Promise.allSettled([promise1, promise2]);
    });

    test("should ignore state changes when modal is cleared", async ({
        mockProductId,
    }) => {
        let subscribeCb: ((state: any) => void) | undefined;
        (mockModalStore.subscribe as any).mockImplementation(
            (cb: (state: any) => void) => {
                subscribeCb = cb;
                return vi.fn();
            }
        );

        const { result } = renderHook(() => useDisplayModalListener());

        const steps = {
            final: { action: { key: "success" } },
        };
        const params = [steps, {}, {}] as any;
        const context = { productId: mockProductId };

        const promise = result.current(params, context as any);

        await waitFor(() => {
            expect(mockModalStore.subscribe).toHaveBeenCalled();
        });

        // Simulate state change with no steps (cleared modal)
        if (subscribeCb) {
            subscribeCb({
                steps: undefined,
                dismissed: false,
                results: {},
            });
        }

        // Promise should not reject or resolve yet
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Now complete properly
        if (subscribeCb) {
            subscribeCb({
                steps: [{ key: "final", params: steps.final }],
                results: { final: { action: { key: "success" } } },
                dismissed: false,
            });
        }

        await promise.catch(() => {});
    });
});
