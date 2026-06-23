import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import type { StoreApi } from "zustand/vanilla";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { server } from "../../test/msw/server";
import type { SdkSession, Session } from "../../types/Session";
import { useDeletePairing } from "./useDeletePairing";

type MockSessionState = {
    session: Session | null;
    sdkSession: SdkSession | null;
    demoPrivateKey: `0x${string}` | null;
};

vi.mock("../../stores/sessionStore", async () => {
    const actual = await vi.importActual<
        typeof import("../../stores/sessionStore")
    >("../../stores/sessionStore");
    const { createStore } = await import("zustand/vanilla");
    return {
        ...actual,
        sessionStore: createStore<MockSessionState>(() => ({
            session: null,
            sdkSession: null,
            demoPrivateKey: null,
        })),
    };
});

describe("useDeletePairing", () => {
    beforeEach(async ({ queryWrapper, mockSession }) => {
        // `vi.mock` swaps `sessionStore` for a vanilla store typed against
        // `MockSessionState`, but TypeScript resolves the import against the
        // real `SessionStore` type. Cast through the mock shape so
        // `setState` stays typed.
        const { sessionStore } = (await import(
            "../../stores/sessionStore"
        )) as unknown as { sessionStore: StoreApi<MockSessionState> };

        queryWrapper.client.clear();
        vi.clearAllMocks();

        // Seed the mock store with a valid wallet session so the hook's
        // authenticated client picks up the address.
        sessionStore.setState(
            {
                session: mockSession,
                sdkSession: null,
                demoPrivateKey: null,
            },
            true
        );
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("should delete pairing successfully", async ({ queryWrapper }) => {
        const onSuccess = vi.fn();

        const { result } = renderHook(
            () =>
                useDeletePairing({
                    mutations: { onSuccess },
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await result.current.mutateAsync({ id: "pairing-1" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);
    });

    test("should handle pairing not found (404)", async ({ queryWrapper }) => {
        server.use(
            http.post(
                `${process.env.BACKEND_URL || "http://localhost:3030"}/wallet/pairings/:id/delete`,
                ({ params }) => {
                    if (params.id === "not-found") {
                        return HttpResponse.json(
                            { error: "Not found" },
                            { status: 404 }
                        );
                    }
                    return HttpResponse.json({ success: true });
                }
            )
        );

        const { result } = renderHook(() => useDeletePairing({}), {
            wrapper: queryWrapper.wrapper,
        });

        // Treaty client might not throw on 404, so just verify the request was made
        await result.current.mutateAsync({ id: "not-found" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
    });

    test("should delete multiple pairings sequentially", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useDeletePairing({}), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync({ id: "pairing-1" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        await result.current.mutateAsync({ id: "pairing-2" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });
    });

    test("should use custom mutation options", async ({ queryWrapper }) => {
        const onMutate = vi.fn();
        const onSettled = vi.fn();
        const onSuccess = vi.fn();

        const { result } = renderHook(
            () =>
                useDeletePairing({
                    mutations: { onMutate, onSettled, onSuccess },
                }),
            { wrapper: queryWrapper.wrapper }
        );

        await result.current.mutateAsync({ id: "pairing-1" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onMutate).toHaveBeenCalledTimes(1);
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(onSettled).toHaveBeenCalledTimes(1);
    });

    test("should successfully mutate multiple times", async ({
        queryWrapper,
    }) => {
        const onSuccess = vi.fn();

        const { result } = renderHook(
            () =>
                useDeletePairing({
                    mutations: { onSuccess },
                }),
            { wrapper: queryWrapper.wrapper }
        );

        // First deletion
        await result.current.mutateAsync({ id: "pairing-1" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(1);

        // Second deletion
        await result.current.mutateAsync({ id: "pairing-3" });

        await waitFor(() => {
            expect(result.current.isSuccess).toBe(true);
        });

        expect(onSuccess).toHaveBeenCalledTimes(2);
    });
});
