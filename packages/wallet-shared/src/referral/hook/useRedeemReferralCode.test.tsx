import { renderHook } from "@testing-library/react";
import { vi } from "vitest";
import {
    afterEach,
    describe,
    expect,
    test,
} from "../../../tests/vitest-fixtures";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { rewardsKey } from "../../common/queryKeys/rewards";
import { referralKey } from "../queryKeys";
import { useRedeemReferralCode } from "./useRedeemReferralCode";

vi.mock("../../common/api/backendClient", () => ({
    authenticatedWalletApi: {
        referral: { code: { redeem: { post: vi.fn() } } },
    },
}));

function redeemReturns(data: object) {
    vi.mocked(
        authenticatedWalletApi.referral.code.redeem.post
    ).mockResolvedValue({ data, error: null } as never);
}

describe("useRedeemReferralCode", () => {
    afterEach(() => {
        vi.resetAllMocks();
    });

    test("refreshes the rewards when the redemption queued one", async ({
        queryWrapper,
    }) => {
        redeemReturns({ kind: "user", signupReward: 1 });
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useRedeemReferralCode(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync({ code: "ABCDEF" });

        expect(invalidate).toHaveBeenCalledWith({
            queryKey: referralKey.status(),
        });
        expect(invalidate).toHaveBeenCalledWith({ queryKey: rewardsKey.all });
    });

    test("leaves the rewards alone when nothing was earned", async ({
        queryWrapper,
    }) => {
        redeemReturns({ kind: "frak" });
        const invalidate = vi.spyOn(queryWrapper.client, "invalidateQueries");
        const { result } = renderHook(() => useRedeemReferralCode(), {
            wrapper: queryWrapper.wrapper,
        });

        await result.current.mutateAsync({ code: "ABCDEF" });

        expect(invalidate).not.toHaveBeenCalledWith({
            queryKey: rewardsKey.all,
        });
    });
});
