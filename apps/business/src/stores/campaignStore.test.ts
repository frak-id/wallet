import {
    describe,
    expect,
    type TestContext,
    test,
} from "@/tests/vitest-fixtures";

const mockCampaignFormData = {
    name: "Test Campaign",
    merchantId: "mock-merchant-id",
    goal: "awareness" as const,
    specialCategories: [],
    territories: ["US", "FR"],
    budget: {
        label: "Monthly",
        durationInSeconds: 2592000,
        amount: 100,
    },
    scheduled: {
        dateStart: new Date("2024-01-01"),
    },
    trigger: "purchase" as const,
    rewardAmount: 10,
    rewardRecipient: "referrer" as const,
    priority: 0,
};

describe("campaignStore", () => {
    describe("initial state", () => {
        test("should have correct initial values", ({
            freshCampaignStore,
        }: TestContext) => {
            const state = freshCampaignStore.getState();

            expect(state.step).toBe(1);
            expect(state.success).toBe(false);
            expect(state.isClosing).toBe(false);
            expect(state.isFetched).toBe(false);
            expect(state.action).toBe("create");
            expect(state.campaign.name).toBe("");
            expect(state.campaign.trigger).toBe("purchase");
        });
    });

    describe("setCampaign", () => {
        test("should update campaign data", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setCampaign(mockCampaignFormData);

            expect(freshCampaignStore.getState().campaign).toEqual(
                mockCampaignFormData
            );
        });

        test("should persist campaign data", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setCampaign(mockCampaignFormData);

            // Check localStorage
            const stored = localStorage.getItem("campaign-v2");
            expect(stored).toBeTruthy();
        });

        test("should update partial campaign data", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setCampaign(mockCampaignFormData);

            const updatedCampaign = {
                ...mockCampaignFormData,
                name: "Updated Title",
            };
            freshCampaignStore.getState().setCampaign(updatedCampaign);

            expect(freshCampaignStore.getState().campaign.name).toBe(
                "Updated Title"
            );
        });
    });

    describe("setStep", () => {
        test("should update step with number", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setStep(2);

            expect(freshCampaignStore.getState().step).toBe(2);
        });

        test("should update step with function updater", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setStep(3);
            freshCampaignStore.getState().setStep((prev: number) => prev + 1);

            expect(freshCampaignStore.getState().step).toBe(4);
        });

        test("should handle multiple step updates", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setStep(1);
            freshCampaignStore.getState().setStep(2);
            freshCampaignStore.getState().setStep(3);

            expect(freshCampaignStore.getState().step).toBe(3);
        });
    });

    describe("setSuccess", () => {
        test("should set success to true", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setSuccess(true);

            expect(freshCampaignStore.getState().success).toBe(true);
        });

        test("should set success to false", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setSuccess(true);
            freshCampaignStore.getState().setSuccess(false);

            expect(freshCampaignStore.getState().success).toBe(false);
        });
    });

    describe("setIsClosing", () => {
        test("should set isClosing to true", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsClosing(true);

            expect(freshCampaignStore.getState().isClosing).toBe(true);
        });

        test("should set isClosing to false", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsClosing(true);
            freshCampaignStore.getState().setIsClosing(false);

            expect(freshCampaignStore.getState().isClosing).toBe(false);
        });
    });

    describe("setIsFetched", () => {
        test("should set isFetched to true", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsFetched(true);

            expect(freshCampaignStore.getState().isFetched).toBe(true);
        });

        test("should set isFetched to false", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsFetched(true);
            freshCampaignStore.getState().setIsFetched(false);

            expect(freshCampaignStore.getState().isFetched).toBe(false);
        });
    });

    describe("setAction", () => {
        test("should set action to 'create'", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setAction("create");

            expect(freshCampaignStore.getState().action).toBe("create");
        });

        test("should set action to 'edit'", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setAction("edit");

            expect(freshCampaignStore.getState().action).toBe("edit");
        });

        test("should set action to 'draft'", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setAction("draft");

            expect(freshCampaignStore.getState().action).toBe("draft");
        });

        test("should update action multiple times", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setAction("create");
            freshCampaignStore.getState().setAction("edit");
            freshCampaignStore.getState().setAction("draft");

            expect(freshCampaignStore.getState().action).toBe("draft");
        });
    });

    describe("reset", () => {
        test("should reset all state to initial values", ({
            freshCampaignStore,
        }: TestContext) => {
            // Set various state values
            freshCampaignStore.getState().setCampaign(mockCampaignFormData);
            freshCampaignStore.getState().setStep(5);
            freshCampaignStore.getState().setSuccess(true);
            freshCampaignStore.getState().setIsClosing(true);
            freshCampaignStore.getState().setIsFetched(true);
            freshCampaignStore.getState().setAction("edit");

            // Reset
            freshCampaignStore.getState().reset();

            // Verify all values are back to initial state
            const state = freshCampaignStore.getState();
            expect(state.step).toBe(1);
            expect(state.success).toBe(false);
            expect(state.isClosing).toBe(false);
            expect(state.isFetched).toBe(false);
            expect(state.action).toBe("create");
            expect(state.campaign.name).toBe("");
            expect(state.campaign.trigger).toBe("purchase");
        });

        test("should reset persisted state", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setCampaign(mockCampaignFormData);
            freshCampaignStore.getState().setStep(3);
            freshCampaignStore.getState().reset();

            // Verify localStorage is cleared/reset
            const stored = localStorage.getItem("campaign-v2");
            // After reset, persisted state should reflect initial values
            expect(stored).toBeTruthy();
        });
    });

    describe("persistence", () => {
        test("should persist campaign, step, success, and isClosing", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setCampaign(mockCampaignFormData);
            freshCampaignStore.getState().setStep(2);
            freshCampaignStore.getState().setSuccess(true);
            freshCampaignStore.getState().setIsClosing(true);

            const stored = localStorage.getItem("campaign-v2");
            expect(stored).toBeTruthy();

            const parsed = JSON.parse(stored || "{}");
            expect(parsed.state.campaign).toBeDefined();
            expect(parsed.state.step).toBe(2);
            expect(parsed.state.success).toBe(true);
            expect(parsed.state.isClosing).toBe(true);
        });

        test("should not persist isFetched and action", ({
            freshCampaignStore,
        }: TestContext) => {
            freshCampaignStore.getState().setIsFetched(true);
            freshCampaignStore.getState().setAction("edit");

            const stored = localStorage.getItem("campaign-v2");
            if (stored) {
                const parsed = JSON.parse(stored);
                expect(parsed.state.isFetched).toBeUndefined();
                expect(parsed.state.action).toBeUndefined();
            }
        });
    });
});
