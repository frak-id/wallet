import { beforeEach, describe, expect, it, vi } from "vitest";
import { AssetLogRepository } from "./AssetLogRepository";

const { unsafe } = vi.hoisted(() => ({ unsafe: vi.fn() }));

vi.mock("../../../infrastructure/persistence/postgres", async () => {
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = { unsafe, options: { parsers: {}, serializers: {} } };
    return { db: drizzle({ client: client as never }) };
});

const flat = (sql: string) => sql.replace(/\s+/g, " ");
const lastSql = () => flat(unsafe.mock.calls.at(-1)?.[0] as string);

describe("AssetLogRepository subscription plans", () => {
    const repository = new AssetLogRepository();

    beforeEach(() => {
        unsafe.mockReset();
        unsafe.mockReturnValue({ values: async () => [] });
    });

    it("counts a plan once against the per-campaign cap", async () => {
        await repository.countByCampaignsAndUserAsReferee(["c1"], "group-1");

        expect(lastSql()).toContain(
            '("asset_logs"."plan_step" IS NULL OR "asset_logs"."plan_step" = 1)'
        );
    });

    it("counts a plan once against the merchant-wide cap", async () => {
        await repository.countByMerchantAndUserAsReferee("m1", "group-1");

        expect(lastSql()).toContain('"asset_logs"."plan_step" = 1');
    });

    it("lists a plan once in the history, by its first step", async () => {
        await repository.findDetailedByIdentityGroup("group-1");

        expect(lastSql()).toContain('"asset_logs"."plan_step" = 1');
    });

    it("counts the history entries the same way", async () => {
        await repository.countByIdentityGroup("group-1");

        expect(lastSql()).toContain('"asset_logs"."plan_step" = 1');
    });

    it("leaves out a step 1 that a live row of the same plan replaced", async () => {
        await repository.countByIdentityGroup("group-1");

        expect(lastSql()).toMatch(
            /not exists \(select "id" from "asset_logs" "live_step_one" where .*"live_step_one"\."interaction_log_id" = "asset_logs"\."interaction_log_id".*"live_step_one"\."recipient_type" = "asset_logs"\."recipient_type".*"live_step_one"\."id" <> "asset_logs"\."id"/
        );
    });

    it("fetches only the later steps of the plans it is asked for", async () => {
        await repository.findPlanSteps("group-1", ["interaction-1"]);

        expect(lastSql()).toContain('"asset_logs"."plan_step" > $');
        await expect(repository.findPlanSteps("group-1", [])).resolves.toEqual(
            []
        );
    });

    it("stores the plan step it is given", () => {
        const [row] = repository.buildInserts([
            {
                identityGroupId: "g",
                merchantId: "m",
                campaignRuleId: "c",
                assetType: "token",
                amount: 5,
                recipientType: "referee",
                interactionLogId: "i",
                held: true,
                planStep: 3,
            },
        ]);

        expect(row).toMatchObject({ planStep: 3 });
        expect(row?.heldAt).toBeInstanceOf(Date);
    });
});
