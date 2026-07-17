import { renderHook, waitFor } from "@testing-library/react";
import { vi } from "vitest";
import {
    campaignConfigQueryKey,
    campaignDetailsQueryKey,
    campaignQueryKey,
    campaignsQueryKey,
} from "@/module/campaigns/queries/queryKeys";
import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";
import { useStatusTransition } from "./useStatusTransition";

vi.mock("@/module/campaigns/api/campaignApi", () => ({
    publishCampaign: vi.fn().mockResolvedValue({ id: "c1" }),
    pauseCampaign: vi.fn().mockResolvedValue({ id: "c1" }),
    resumeCampaign: vi.fn().mockResolvedValue({ id: "c1" }),
    archiveCampaign: vi.fn().mockResolvedValue({ id: "c1" }),
}));

describe("useStatusTransition", () => {
    test("invalidates the campaign list and the single-campaign caches after a transition", async ({
        queryWrapper,
    }: TestContext) => {
        const { client, wrapper } = queryWrapper;
        const invalidateSpy = vi.spyOn(client, "invalidateQueries");

        const { result } = renderHook(() => useStatusTransition(), {
            wrapper,
        });
        result.current.mutate({
            merchantId: "m1",
            campaignId: "c1",
            action: "pause",
        });
        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        // List/overview caches (`["campaigns", ...]`).
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: campaignsQueryKey(),
        });
        // Single-campaign caches (`["campaign", ...]`) — the root key, so the
        // details sheet actually refetches (regression: keying on campaignId
        // alone matched nothing).
        expect(invalidateSpy).toHaveBeenCalledWith({
            queryKey: campaignQueryKey(),
        });
    });

    test("the invalidated single-campaign key prefixes the real detail + config caches", () => {
        const root = campaignQueryKey();
        const config = campaignConfigQueryKey("m1", "c1", false);
        const details = campaignDetailsQueryKey("m1", "c1", false);
        // A prefix match is what makes the invalidation reach these caches;
        // their keys interleave merchantId before campaignId, which is why a
        // `["campaign", campaignId]` key never matched.
        expect(config.slice(0, root.length)).toEqual([...root]);
        expect(details.slice(0, root.length)).toEqual([...root]);
    });
});
