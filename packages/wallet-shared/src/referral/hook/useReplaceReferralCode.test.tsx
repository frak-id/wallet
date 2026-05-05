import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest"; // Keep vi from vitest for vi.mock() hoisting
import {
    afterEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { referralKey } from "../queryKeys";
import { useReplaceReferralCode } from "./useReplaceReferralCode";

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        referral: {
            code: {
                delete: vi.fn(),
                issue: { post: vi.fn() },
            },
        },
    },
}));

// `describe.sequential` because the shared `vitest.shared.ts` runs tests
// concurrently inside a file by default, and our mocks live on a single
// module-scoped `authenticatedWalletApi` — concurrent `mockResolvedValue`
// calls from sibling tests leak into each other otherwise.
describe.sequential("useReplaceReferralCode", () => {
    afterEach(() => {
        // resetAllMocks clears both call history AND queued resolutions so
        // each test starts from a clean slate.
        vi.resetAllMocks();
    });

    test("revoke 204 + issue 200 returns the new code", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.delete
        ).mockResolvedValue({ error: null, status: 204 } as never);
        vi.mocked(
            authenticatedWalletApi.referral.code.issue.post
        ).mockResolvedValue({
            data: { code: "NEWNEW", createdAt: "2026-04-30T00:00:00Z" },
            error: null,
        } as never);

        const { result } = renderHook(() => useReplaceReferralCode(), {
            wrapper: queryWrapper.wrapper,
        });

        const data = await result.current.mutateAsync({ code: "NEWNEW" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(data?.code).toBe("NEWNEW");
        expect(
            authenticatedWalletApi.referral.code.delete
        ).toHaveBeenCalledTimes(1);
        expect(
            authenticatedWalletApi.referral.code.issue.post
        ).toHaveBeenCalledWith({ code: "NEWNEW" });
    });

    test("revoke 404 + issue 200 succeeds (idempotent retry path)", async ({
        queryWrapper,
    }) => {
        // Replay: previous attempt revoked the code, then issue failed.
        // Second attempt's revoke returns 404 — must be treated as success
        // so the chain proceeds to issue.
        vi.mocked(
            authenticatedWalletApi.referral.code.delete
        ).mockResolvedValue({
            error: { value: "Not Found", status: 404 },
            status: 404,
        } as never);
        vi.mocked(
            authenticatedWalletApi.referral.code.issue.post
        ).mockResolvedValue({
            data: { code: "RETRY1", createdAt: "2026-04-30T00:00:00Z" },
            error: null,
        } as never);

        const { result } = renderHook(() => useReplaceReferralCode(), {
            wrapper: queryWrapper.wrapper,
        });

        const data = await result.current.mutateAsync({ code: "RETRY1" });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));
        expect(data?.code).toBe("RETRY1");
        expect(
            authenticatedWalletApi.referral.code.issue.post
        ).toHaveBeenCalledTimes(1);
    });

    test("revoke non-404 error throws WITHOUT invalidating status (active code still intact)", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.delete
        ).mockResolvedValue({
            error: { value: "Internal Server Error", status: 500 },
            status: 500,
        } as never);

        const invalidateSpy = vi.spyOn(
            queryWrapper.client,
            "invalidateQueries"
        );

        const { result } = renderHook(() => useReplaceReferralCode(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.mutateAsync({ code: "FAIL01" })
        ).rejects.toBeDefined();

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(
            authenticatedWalletApi.referral.code.issue.post
        ).not.toHaveBeenCalled();
        // The active code is still on the server when revoke fails non-404,
        // so the cache stays correct without an invalidation round-trip.
        expect(invalidateSpy).not.toHaveBeenCalled();
    });

    test("revoke 204 + issue 409 (CODE_UNAVAILABLE) invalidates status so the cache reflects the now-empty wallet", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.delete
        ).mockResolvedValue({ error: null, status: 204 } as never);
        vi.mocked(
            authenticatedWalletApi.referral.code.issue.post
        ).mockResolvedValue({
            data: null,
            error: { value: { code: "CODE_UNAVAILABLE" }, status: 409 },
        } as never);

        const invalidateSpy = vi.spyOn(
            queryWrapper.client,
            "invalidateQueries"
        );

        const { result } = renderHook(() => useReplaceReferralCode(), {
            wrapper: queryWrapper.wrapper,
        });

        await expect(
            result.current.mutateAsync({ code: "RACED1" })
        ).rejects.toBeDefined();

        await waitFor(() => expect(result.current.isError).toBe(true));

        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: referralKey.status(),
        });
    });

    test("invokes the caller-provided onError on chain failure", async ({
        queryWrapper,
    }) => {
        vi.mocked(
            authenticatedWalletApi.referral.code.delete
        ).mockResolvedValue({ error: null, status: 204 } as never);
        vi.mocked(
            authenticatedWalletApi.referral.code.issue.post
        ).mockResolvedValue({
            data: null,
            error: { value: { code: "CODE_UNAVAILABLE" }, status: 409 },
        } as never);

        const onError = vi.fn();
        const { result } = renderHook(
            () => useReplaceReferralCode({ mutations: { onError } }),
            { wrapper: queryWrapper.wrapper }
        );

        await result.current.mutateAsync({ code: "RACED2" }).catch(() => {});

        await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    });
});
