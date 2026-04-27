import { describe, expect, it, vi } from "vitest";
import { CampaignRuleRepository } from "./CampaignRuleRepository";

describe("CampaignRuleRepository.restoreBudgetsBatch", () => {
    it("groups rewards by campaign and forwards a single restoreBudget call per campaign", async () => {
        const repo = new CampaignRuleRepository();
        const restoreSpy = vi
            .spyOn(repo, "restoreBudget")
            .mockResolvedValue(undefined);

        const restored = await repo.restoreBudgetsBatch([
            { campaignRuleId: "campaign-1", amount: "100" },
            { campaignRuleId: "campaign-1", amount: "25.5" },
            { campaignRuleId: "campaign-2", amount: "10" },
        ]);

        expect(restored).toEqual({ "campaign-1": 125.5, "campaign-2": 10 });
        expect(restoreSpy).toHaveBeenCalledTimes(2);
        expect(restoreSpy).toHaveBeenCalledWith("campaign-1", 125.5);
        expect(restoreSpy).toHaveBeenCalledWith("campaign-2", 10);
    });

    it("ignores rewards without a campaignRuleId (legacy data)", async () => {
        const repo = new CampaignRuleRepository();
        const restoreSpy = vi
            .spyOn(repo, "restoreBudget")
            .mockResolvedValue(undefined);

        const restored = await repo.restoreBudgetsBatch([
            { campaignRuleId: null, amount: "999" },
            { campaignRuleId: "campaign-1", amount: "1" },
        ]);

        expect(restored).toEqual({ "campaign-1": 1 });
        expect(restoreSpy).toHaveBeenCalledTimes(1);
    });

    it("returns an empty record when given no rewards", async () => {
        const repo = new CampaignRuleRepository();
        const restoreSpy = vi
            .spyOn(repo, "restoreBudget")
            .mockResolvedValue(undefined);

        const restored = await repo.restoreBudgetsBatch([]);

        expect(restored).toEqual({});
        expect(restoreSpy).not.toHaveBeenCalled();
    });
});
