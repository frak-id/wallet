import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import type { SdkSession, Session } from "../../types/Session";
import { useGetSafeSdkSession } from "./useGetSafeSdkSession";

type MockSessionState = {
    session: Session | null;
    sdkSession: SdkSession | null;
};

vi.mock("../../stores/sessionStore", async () => {
    const { createStore } = await import("zustand/vanilla");
    return {
        sessionStore: createStore<MockSessionState>(() => ({
            session: null,
            sdkSession: null,
        })),
        selectSession: vi.fn((state: MockSessionState) => state.session),
        selectSdkSession: vi.fn((state: MockSessionState) => state.sdkSession),
    };
});

vi.mock("../auth/ensureFreshSdkSession", () => ({
    ensureFreshSdkSession: vi.fn(),
}));

describe("useGetSafeSdkSession", () => {
    let mockEnsure: ReturnType<typeof vi.fn>;
    let mockSessionState: MockSessionState;

    beforeEach(async () => {
        const { ensureFreshSdkSession } = await import(
            "../auth/ensureFreshSdkSession"
        );
        mockEnsure = vi.mocked(ensureFreshSdkSession);

        const { sessionStore } = await import("../../stores/sessionStore");
        mockSessionState =
            sessionStore.getState() as unknown as MockSessionState;

        // Reset to clean state
        mockSessionState.session = null;
        mockSessionState.sdkSession = null;
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    test("returns null when ensureFreshSdkSession returns dead", async ({
        queryWrapper,
    }) => {
        mockEnsure.mockResolvedValue({ status: "dead" });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.sdkSession).toBeNull();
    });

    test("returns sdk when ensureFreshSdkSession returns fresh", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        mockEnsure.mockResolvedValue({
            status: "fresh",
            sdk: mockSdkSession,
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.sdkSession).toEqual(mockSdkSession);
    });

    test("returns sdk when ensureFreshSdkSession returns stale with token", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        mockEnsure.mockResolvedValue({
            status: "stale",
            sdk: mockSdkSession,
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.sdkSession).toEqual(mockSdkSession);
    });

    test("returns null when ensureFreshSdkSession returns stale with null sdk", async ({
        queryWrapper,
    }) => {
        mockEnsure.mockResolvedValue({
            status: "stale",
            sdk: null,
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.sdkSession).toBeNull();
    });

    test("exposes getSdkSession as a refetch function", async ({
        queryWrapper,
        mockSdkSession,
    }) => {
        mockEnsure.mockResolvedValue({
            status: "fresh",
            sdk: mockSdkSession,
        });

        const { result } = renderHook(() => useGetSafeSdkSession(), {
            wrapper: queryWrapper.wrapper,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(typeof result.current.getSdkSession).toBe("function");
    });
});
