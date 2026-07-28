import { describe, expect, test } from "@/tests/vitest-fixtures";
import {
    affiliateReportQueryKey,
    campaignConfigQueryKey,
    campaignDetailsQueryKey,
    campaignQueryKey,
    campaignsListQueryKey,
    campaignsQueryKey,
    overviewAnalyticsQueryKey,
    overviewSummaryQueryKey,
} from "./queryKeys";

describe("campaign query keys", () => {
    test("builders return the exact tuples the call sites inlined", () => {
        expect(campaignsQueryKey()).toEqual(["campaigns"]);
        expect(campaignsListQueryKey("m1", false)).toEqual([
            "campaigns",
            "list",
            "m1",
            "live",
        ]);
        expect(
            overviewSummaryQueryKey("m1", true, undefined, undefined, "eur")
        ).toEqual([
            "campaigns",
            "overview",
            "summary",
            "m1",
            "demo",
            null,
            null,
            "eur",
        ]);
        expect(
            overviewSummaryQueryKey(
                "m1",
                false,
                "2026-01-01",
                "2026-02-01",
                "usd"
            )
        ).toEqual([
            "campaigns",
            "overview",
            "summary",
            "m1",
            "live",
            "2026-01-01",
            "2026-02-01",
            "usd",
        ]);
        expect(
            overviewAnalyticsQueryKey("m1", false, undefined, undefined)
        ).toEqual([
            "campaigns",
            "overview",
            "analytics",
            "m1",
            "live",
            null,
            null,
        ]);
        expect(
            affiliateReportQueryKey("m1", false, undefined, undefined)
        ).toEqual(["campaigns", "affiliate-report", "m1", "live", null, null]);
        expect(campaignQueryKey()).toEqual(["campaign"]);
        expect(campaignDetailsQueryKey("m1", "c1", false)).toEqual([
            "campaign",
            "details",
            "m1",
            "c1",
            "live",
        ]);
        expect(campaignConfigQueryKey("m1", "c1", true)).toEqual([
            "campaign",
            "m1",
            "c1",
            "demo",
        ]);
    });

    test("scoped list/overview keys prefix the campaigns base key", () => {
        const base = campaignsQueryKey();
        expect(
            campaignsListQueryKey("m1", false).slice(0, base.length)
        ).toEqual([...base]);
        expect(
            overviewSummaryQueryKey(
                "m1",
                false,
                undefined,
                undefined,
                "eur"
            ).slice(0, base.length)
        ).toEqual([...base]);
    });
});
