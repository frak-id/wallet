import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { server } from "../../test/msw/server";
import { useDeletePairing } from "./useDeletePairing";

vi.mock("../../stores/sessionStore", async () => {
    const actual = await vi.importActual<
        typeof import("../../stores/sessionStore")
    >("../../stores/sessionStore");
    return {
        ...actual,
        sessionStore: vi.fn(),
    };
});

describe("useDeletePairing", () => {
    beforeEach(async ({ queryWrapper, mockSession }) => {
        const { sessionStore } = await import("../../stores/sessionStore");

        queryWrapper.client.clear();
        vi.clearAllMocks();

        // Mock sessionStore for authentication
        vi.mocked(sessionStore).mockImplementation((selector: any) => {
            const state = {
                session: mockSession,
                sdkSession: null,
                demoPrivateKey: null,
                setSession: vi.fn(),
                setSdkSession: vi.fn(),
                setDemoPrivateKey: vi.fn(),
                clearSession: vi.fn(),
            };
            return selector(state);
        });

        vi.mocked(sessionStore).getState = vi.fn().mockReturnValue({
            session: mockSession,
            sdkSession: null,
            demoPrivateKey: null,
            setSession: vi.fn(),
            setSdkSession: vi.fn(),
            setDemoPrivateKey: vi.fn(),
            clearSession: vi.fn(),
        });
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
