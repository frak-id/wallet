/** @jsxImportSource react */
import { act, renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    test,
} from "@/tests/vitest-fixtures";
import { useSendEmailVerification } from "./useSendEmailVerification";

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const original =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return {
        ...original,
        authenticatedWalletApi: {
            auth: { email: { verification: { post: vi.fn() } } },
        },
    };
});

describe("useSendEmailVerification", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    test("starts with no active cooldown", async ({ queryWrapper }) => {
        const { result } = renderHook(() => useSendEmailVerification(), {
            wrapper: queryWrapper.wrapper,
        });
        expect(result.current.cooldownSeconds).toBe(0);
    });

    test("starts a ~30s cooldown after a sent result", async ({
        queryWrapper,
    }) => {
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );
        vi.mocked(
            authenticatedWalletApi.auth.email.verification.post
        ).mockResolvedValue({ data: { status: "sent" }, error: null } as never);

        const { result } = renderHook(() => useSendEmailVerification(), {
            wrapper: queryWrapper.wrapper,
        });
        await act(async () => {
            await result.current.sendCode();
        });

        await waitFor(() => {
            expect(result.current.cooldownSeconds).toBeGreaterThan(0);
        });
        expect(result.current.cooldownSeconds).toBeGreaterThanOrEqual(29);
        expect(result.current.cooldownSeconds).toBeLessThanOrEqual(31);
    });

    test("reflects the server retryAfterSec when throttled", async ({
        queryWrapper,
    }) => {
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );
        vi.mocked(
            authenticatedWalletApi.auth.email.verification.post
        ).mockResolvedValue({
            data: { status: "throttled", retryAfterSec: 25 },
            error: null,
        } as never);

        const { result } = renderHook(() => useSendEmailVerification(), {
            wrapper: queryWrapper.wrapper,
        });
        await act(async () => {
            await result.current.sendCode("new@test.com");
        });

        await waitFor(() => {
            expect(result.current.cooldownSeconds).toBeGreaterThan(0);
        });
        expect(result.current.cooldownSeconds).toBeGreaterThanOrEqual(24);
        expect(result.current.cooldownSeconds).toBeLessThanOrEqual(26);
    });

    test("returns a conflict result without starting a cooldown", async ({
        queryWrapper,
    }) => {
        const { authenticatedWalletApi } = await import(
            "@frak-labs/wallet-shared"
        );
        vi.mocked(
            authenticatedWalletApi.auth.email.verification.post
        ).mockResolvedValue({
            data: {
                status: "conflict",
                authenticatorIds: ["auth-1"],
                wallet: "0x1234567890123456789012345678901234567890",
            },
            error: null,
        } as never);

        const { result } = renderHook(() => useSendEmailVerification(), {
            wrapper: queryWrapper.wrapper,
        });
        const response = await result.current.sendCode("taken@test.com");

        expect(response.status).toBe("conflict");
        expect(result.current.cooldownSeconds).toBe(0);
    });
});
