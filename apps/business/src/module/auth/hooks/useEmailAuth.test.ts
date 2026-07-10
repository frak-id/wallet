import { renderHook } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import {
    useConfirmPasswordReset,
    useRequestPasswordReset,
} from "./useEmailAuth";

const { mockResetRequest, mockResetConfirm } = vi.hoisted(() => ({
    mockResetRequest: vi.fn(),
    mockResetConfirm: vi.fn(),
}));

vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        auth: {
            password: {
                reset: {
                    request: { post: mockResetRequest },
                    confirm: { post: mockResetConfirm },
                },
            },
        },
    },
}));

describe("password reset hooks (§P1)", () => {
    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("useRequestPasswordReset", () => {
        test("returns the generic message on success", async ({
            queryWrapper,
        }: TestContext) => {
            mockResetRequest.mockResolvedValue({
                data: { message: "If an account exists, a code was sent" },
                error: null,
            });

            const { result } = renderHook(() => useRequestPasswordReset(), {
                wrapper: queryWrapper.wrapper,
            });

            const data = await result.current.mutateAsync({
                email: "user@test.com",
            });
            expect(data).toEqual({
                message: "If an account exists, a code was sent",
            });
            expect(mockResetRequest).toHaveBeenCalledWith({
                email: "user@test.com",
            });
        });

        test("throws a readable message on an Eden error", async ({
            queryWrapper,
        }: TestContext) => {
            mockResetRequest.mockResolvedValue({
                data: null,
                error: { status: 429, value: "Too many requests" },
            });

            const { result } = renderHook(() => useRequestPasswordReset(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({ email: "user@test.com" })
            ).rejects.toThrow("Too many requests");
        });
    });

    describe("useConfirmPasswordReset", () => {
        test("resolves on a verified reset", async ({
            queryWrapper,
        }: TestContext) => {
            mockResetConfirm.mockResolvedValue({
                data: { success: true },
                error: null,
            });

            const { result } = renderHook(() => useConfirmPasswordReset(), {
                wrapper: queryWrapper.wrapper,
            });

            const data = await result.current.mutateAsync({
                email: "user@test.com",
                code: "123456",
                password: "a-strong-password",
            });
            expect(data).toEqual({ success: true });
        });

        test("surfaces the generic invalid-code error", async ({
            queryWrapper,
        }: TestContext) => {
            mockResetConfirm.mockResolvedValue({
                data: null,
                error: {
                    status: 400,
                    value: {
                        code: "INVALID_CODE",
                        message: "Invalid or expired code",
                    },
                },
            });

            const { result } = renderHook(() => useConfirmPasswordReset(), {
                wrapper: queryWrapper.wrapper,
            });

            await expect(
                result.current.mutateAsync({
                    email: "user@test.com",
                    code: "000000",
                    password: "a-strong-password",
                })
            ).rejects.toThrow("Invalid or expired code");
        });
    });
});
