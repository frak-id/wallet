import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    campaignQueryKey,
    campaignsQueryKey,
} from "@/module/campaigns/queries/queryKeys";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useUpdateCampaignRunningStatus } from "./useUpdateCampaignRunningStatus";

vi.mock("@/module/campaigns/api/campaignApi", () => ({
    pauseCampaign: vi.fn().mockResolvedValue({ id: "c1" }),
    resumeCampaign: vi.fn().mockResolvedValue({ id: "c1" }),
}));

describe("useUpdateCampaignRunningStatus", () => {
    test("invalidates the campaign list and the single-campaign caches after a status change", async ({
        queryWrapper,
    }: TestContext) => {
        const { client, wrapper } = queryWrapper;
        const invalidateSpy = vi.spyOn(client, "invalidateQueries");

        const { result } = renderHook(() => useUpdateCampaignRunningStatus(), {
            wrapper,
        });
        result.current.mutate({
            merchantId: "m1",
            campaignId: "c1",
            shouldRun: false,
        });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: campaignsQueryKey(),
        });
        // Root single-campaign key so the details sheet actually refetches.
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: campaignQueryKey(),
        });
    });
});
