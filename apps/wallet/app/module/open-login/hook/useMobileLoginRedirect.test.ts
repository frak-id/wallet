import { renderHook } from "@testing-library/react";
import type { Hex } from "viem";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useMobileLoginRedirect } from "./useMobileLoginRedirect";

const mockGenerateAuthCode = vi.fn();
const mockSessionStoreGetState = vi.fn();

vi.mock("./useGenerateMobileAuthCode", () => ({
    useGenerateMobileAuthCode: () => ({
        generateAuthCode: mockGenerateAuthCode,
        isGenerating: false,
        error: null,
    }),
}));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...original,
        sessionStore: {
            getState: () => mockSessionStoreGetState(),
        },
    };
});

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isTauri: vi.fn(() => false),
}));

describe("useMobileLoginRedirect", () => {
    const mockProductId: Hex = "0x1234567890abcdef";
    const mockReturnUrl = "https://partner-site.com/callback";
    const mockState = "random-state-123";
    const mockAuthCode = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mockPayload";

    const mockSession = {
        address: "0x1234567890abcdef1234567890abcdef12345678",
        token: "mock-token",
    };

    beforeEach(() => {
        vi.clearAllMocks();
        mockGenerateAuthCode.mockResolvedValue({ authCode: mockAuthCode });
        mockSessionStoreGetState.mockReturnValue({ session: mockSession });
        Object.defineProperty(window, "location", {
            value: { href: "" },
            writable: true,
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("should initialize with correct default state", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useMobileLoginRedirect(), {
            wrapper: queryWrapper.wrapper,
        });

        expect(result.current.executeRedirect).toBeDefined();
        expect(result.current.isRedirecting).toBe(false);
        expect(result.current.error).toBeNull();
    });

    test("should throw error when no session exists", async ({
        queryWrapper,
    }) => {
        mockSessionStoreGetState.mockReturnValue({ session: null });

        const { result } = renderHook(() => useMobileLoginRedirect(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.executeRedirect({
                returnUrl: mockReturnUrl,
                productId: mockProductId,
                state: mockState,
            })
        ).rejects.toThrow("No active session");
    });

    test("should generate auth code and redirect in web mode", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useMobileLoginRedirect(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.executeRedirect({
            returnUrl: mockReturnUrl,
            productId: mockProductId,
            state: mockState,
        });

        expect(mockGenerateAuthCode).toHaveBeenCalledWith({
            productId: mockProductId,
            returnOrigin: "https://partner-site.com",
        });

        expect(window.location.href).toContain(mockReturnUrl);
        expect(window.location.href).toContain(`frakAuth=${mockAuthCode}`);
        expect(window.location.href).toContain(`state=${mockState}`);
    });

    test("should redirect without state when not provided", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useMobileLoginRedirect(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.executeRedirect({
            returnUrl: mockReturnUrl,
            productId: mockProductId,
        });

        expect(window.location.href).toContain(`frakAuth=${mockAuthCode}`);
        expect(window.location.href).not.toContain("state=");
    });

    test("should extract origin from returnUrl correctly", async ({
        queryWrapper,
    }) => {
        const { result } = renderHook(() => useMobileLoginRedirect(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.executeRedirect({
            returnUrl: "https://example.com:8080/some/path?existing=param",
            productId: mockProductId,
        });

        expect(mockGenerateAuthCode).toHaveBeenCalledWith({
            productId: mockProductId,
            returnOrigin: "https://example.com:8080",
        });
    });

    test("should open browser in Tauri mode", async ({ queryWrapper }) => {
        const { isTauri } = await import(
            "@frak-labs/app-essentials/utils/platform"
        );
        vi.mocked(isTauri).mockReturnValue(true);

        const mockOpen = vi.fn();
        vi.doMock("@tauri-apps/plugin-shell", () => ({
            open: mockOpen,
        }));

        const { result } = renderHook(() => useMobileLoginRedirect(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.executeRedirect({
            returnUrl: mockReturnUrl,
            productId: mockProductId,
            state: mockState,
        });

        expect(mockGenerateAuthCode).toHaveBeenCalled();
    });
});
