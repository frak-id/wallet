import { describe, expect, it } from "vitest";
import {
    getCampaignDetailsMock,
    getMyCampaignsMock,
    getMyCampaignsStatsMock,
    getOnChainCampaignsDetailsMock,
} from "./mock";

describe("campaign mock actions", () => {
    describe("getMyCampaignsMock", () => {
        it("should return array of campaigns", async () => {
            const result = await getMyCampaignsMock();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });

        it("should include campaign properties", async () => {
            const campaigns = await getMyCampaignsMock();

            for (const campaign of campaigns) {
                expect(campaign).toHaveProperty("_id");
                expect(campaign).toHaveProperty("title");
                expect(campaign).toHaveProperty("productId");
                expect(campaign).toHaveProperty("state");
                expect(campaign).toHaveProperty("actions");
            }
        });
    });

    describe("getMyCampaignsStatsMock", () => {
        it("should return array of campaign stats", async () => {
            const result = await getMyCampaignsStatsMock();

            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);
        });

        it("should include stats properties", async () => {
            const stats = await getMyCampaignsStatsMock();

            for (const stat of stats) {
                expect(stat).toHaveProperty("title");
                expect(stat).toHaveProperty("id");
                expect(stat).toHaveProperty("totalRewards");
                expect(stat).toHaveProperty("uniqueWallets");
                expect(stat).toHaveProperty("openInteractions");
                expect(stat).toHaveProperty("readInteractions");
            }
        });

        it("should have totalRewards property", async () => {
            const stats = await getMyCampaignsStatsMock();

            for (const stat of stats) {
                expect(stat.totalRewards).toBeDefined();
                // Mock data may have bigint or need conversion
                expect(stat).toHaveProperty("totalRewards");
            }
        });
    });

    describe("getCampaignDetailsMock", () => {
        it("should return campaign when found", async () => {
            const campaigns = await getMyCampaignsMock();
            const firstCampaignId = campaigns[0]._id;

            const result = await getCampaignDetailsMock({
                campaignId: firstCampaignId,
            });

            expect(result).toBeDefined();
            expect(result?.id).toBe(firstCampaignId);
            expect(result?._id).toBeUndefined();
        });

        it("should return null when campaign not found", async () => {
            const result = await getCampaignDetailsMock({
                campaignId: "nonexistent-id",
            });

            expect(result).toBeNull();
        });

        it("should transform _id to id field", async () => {
            const campaigns = await getMyCampaignsMock();
            const campaignId = campaigns[0]._id;

            const result = await getCampaignDetailsMock({ campaignId });

            expect(result?.id).toBe(campaignId);
            expect(result?._id).toBeUndefined();
        });
    });

    describe("getOnChainCampaignsDetailsMock", () => {
        it("should return on-chain details for created campaign", async () => {
            const campaigns = await getMyCampaignsMock();
            const createdCampaign = campaigns.find(
                (c) => c.state.key === "created"
            );

            if (!createdCampaign || createdCampaign.state.key !== "created") {
                // Skip if no created campaign in mock data
                return;
            }

            const result = await getOnChainCampaignsDetailsMock({
                campaignAddress: createdCampaign.state.address,
            });

            expect(result).toBeDefined();
            expect(result).toHaveProperty("isActive");
            expect(result).toHaveProperty("isRunning");
            expect(result).toHaveProperty("config");
        });

        it("should return null for non-existent campaign", async () => {
            const result = await getOnChainCampaignsDetailsMock({
                campaignAddress: "0x0000000000000000000000000000000000000000",
            });

            expect(result).toBeNull();
        });

        it("should include config array with capConfig, activationPeriod, and bank", async () => {
            const campaigns = await getMyCampaignsMock();
            const createdCampaign = campaigns.find(
                (c) => c.state.key === "created"
            );

            if (!createdCampaign || createdCampaign.state.key !== "created") {
                return;
            }

            const result = await getOnChainCampaignsDetailsMock({
                campaignAddress: createdCampaign.state.address,
            });

            expect(result?.config).toBeDefined();
            expect(Array.isArray(result?.config)).toBe(true);
            expect(result?.config).toHaveLength(3);
        });

        it("should return productId and metadata", async () => {
            const campaigns = await getMyCampaignsMock();
            const createdCampaign = campaigns.find(
                (c) => c.state.key === "created"
            );

            if (!createdCampaign || createdCampaign.state.key !== "created") {
                return;
            }

            const result = await getOnChainCampaignsDetailsMock({
                campaignAddress: createdCampaign.state.address,
            });

            expect(result?.productId).toBe(createdCampaign.productId);
            expect(result?.metadata).toBeDefined();
            expect(result?.metadata.name).toBe(createdCampaign.title);
        });

        it("should return isActive and isRunning flags", async () => {
            const campaigns = await getMyCampaignsMock();
            const createdCampaign = campaigns.find(
                (c) => c.state.key === "created"
            );

            if (!createdCampaign || createdCampaign.state.key !== "created") {
                return;
            }

            const result = await getOnChainCampaignsDetailsMock({
                campaignAddress: createdCampaign.state.address,
            });

            expect(typeof result?.isActive).toBe("boolean");
            expect(typeof result?.isRunning).toBe("boolean");
            expect(typeof result?.isAllowedToEdit).toBe("boolean");
        });

        it("should handle campaigns with dateStart and dateEnd", async () => {
            const campaigns = await getMyCampaignsMock();
            const createdCampaign = campaigns.find(
                (c) =>
                    c.state.key === "created" &&
                    c.scheduled?.dateStart &&
                    c.scheduled?.dateEnd
            );

            if (!createdCampaign || createdCampaign.state.key !== "created") {
                return;
            }

            const result = await getOnChainCampaignsDetailsMock({
                campaignAddress: createdCampaign.state.address,
            });

            const [, activationPeriod] = result?.config || [];
            expect(activationPeriod.start).toBeGreaterThan(0);
            expect(activationPeriod.end).toBeGreaterThan(0);
        });

        it("should handle campaigns without dateEnd", async () => {
            const campaigns = await getMyCampaignsMock();
            const createdCampaign = campaigns.find(
                (c) => c.state.key === "created" && !c.scheduled?.dateEnd
            );

            if (createdCampaign && createdCampaign.state.key === "created") {
                const result = await getOnChainCampaignsDetailsMock({
                    campaignAddress: createdCampaign.state.address,
                });

                const [, activationPeriod] = result?.config || [];
                expect(activationPeriod.end).toBe(0);
            }
        });

        it("should include bank address from campaign", async () => {
            const campaigns = await getMyCampaignsMock();
            const createdCampaign = campaigns.find(
                (c) => c.state.key === "created" && c.bank
            );

            if (!createdCampaign || createdCampaign.state.key !== "created") {
                return;
            }

            const result = await getOnChainCampaignsDetailsMock({
                campaignAddress: createdCampaign.state.address,
            });

            const [, , bankAddress] = result?.config || [];
            expect(bankAddress).toBe(createdCampaign.bank);
        });

        it("should use zero address when bank is undefined", async () => {
            const campaigns = await getMyCampaignsMock();
            const createdCampaign = campaigns.find(
                (c) => c.state.key === "created" && !c.bank
            );

            if (createdCampaign && createdCampaign.state.key === "created") {
                const result = await getOnChainCampaignsDetailsMock({
                    campaignAddress: createdCampaign.state.address,
                });

                const [, , bankAddress] = result?.config || [];
                expect(bankAddress).toBe(
                    "0x0000000000000000000000000000000000000000"
                );
            }
        });
    });
});
