import { describe, expect, it, vi } from "vitest";
import type { BudgetConfig, BudgetUsed } from "../schemas";
import {
    CampaignRuleRepository,
    processBudgetRestore,
} from "./CampaignRuleRepository";

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

describe("processBudgetRestore", () => {
    const lifetimeBudget: BudgetConfig = [
        { label: "total", durationInSeconds: null, amount: 1000 },
    ];

    it("subtracts the amount from a non-windowed budget", () => {
        const used: BudgetUsed = { total: { used: 250 } };

        const result = processBudgetRestore(lifetimeBudget, used, 100);

        expect(result.total.used).toBe(150);
        expect(result.total.resetAt).toBeUndefined();
    });

    it("never drives usage below zero", () => {
        const used: BudgetUsed = { total: { used: 40 } };

        const result = processBudgetRestore(lifetimeBudget, used, 100);

        expect(result.total.used).toBe(0);
    });

    it("subtracts within a still-current window and keeps resetAt", () => {
        const resetAt = new Date(Date.now() + 60_000).toISOString();
        const config: BudgetConfig = [
            { label: "daily", durationInSeconds: 86_400, amount: 500 },
        ];
        const used: BudgetUsed = { daily: { used: 200, resetAt } };

        const result = processBudgetRestore(config, used, 50);

        expect(result.daily.used).toBe(150);
        expect(result.daily.resetAt).toBe(resetAt);
    });

    it("resets an elapsed window to zero instead of deducting from the fresh window", () => {
        const past = new Date(Date.now() - 60_000).toISOString();
        const config: BudgetConfig = [
            { label: "daily", durationInSeconds: 86_400, amount: 500 },
        ];
        const used: BudgetUsed = { daily: { used: 30, resetAt: past } };

        const result = processBudgetRestore(config, used, 100);

        expect(result.daily.used).toBe(0);
        expect(result.daily.resetAt).toBeDefined();
        expect(
            new Date(result.daily.resetAt as string).getTime()
        ).toBeGreaterThan(Date.now());
    });

    it("ignores budgets that have no recorded usage", () => {
        const result = processBudgetRestore(lifetimeBudget, {}, 100);

        expect(result.total).toBeUndefined();
    });

    it("does not mutate the input usage object", () => {
        const used: BudgetUsed = { total: { used: 250 } };

        processBudgetRestore(lifetimeBudget, used, 100);

        expect(used.total.used).toBe(250);
    });
});
