import { beforeEach, describe, expect, it, vi } from "vitest";

const { listGet, configGet, membersPost } = vi.hoisted(() => ({
    listGet: vi.fn(),
    configGet: vi.fn(),
    membersPost: vi.fn(),
}));

vi.mock("@/api/backendClient", () => ({
    authenticatedBackendApi: {
        merchant: Object.assign(
            vi.fn(() => ({
                campaigns: Object.assign(
                    vi.fn(() => ({ get: configGet })),
                    { get: listGet }
                ),
            })),
            { members: { post: membersPost } }
        ),
    },
}));

import { getMerchantMembers } from "@/module/members/api/getMerchantMembers";
import { getCampaignConfig, getMerchantCampaigns } from "./campaignApi";

const serverError = { status: 500, value: "Internal Server Error" };

describe("business list fetchers on a backend error", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("getMerchantCampaigns throws instead of returning an empty list", async () => {
        listGet.mockResolvedValue({ data: null, error: serverError });
        await expect(
            getMerchantCampaigns({ merchantId: "m1", isDemoMode: false })
        ).rejects.toThrow("Failed to load campaigns");
    });

    it("getCampaignConfig returns null for a 404", async () => {
        configGet.mockResolvedValue({
            data: null,
            error: { status: 404, value: "Campaign not found" },
        });
        await expect(
            getCampaignConfig({
                merchantId: "m1",
                campaignId: "c1",
                isDemoMode: false,
            })
        ).resolves.toBeNull();
    });

    it("getCampaignConfig throws on any other error", async () => {
        configGet.mockResolvedValue({ data: null, error: serverError });
        await expect(
            getCampaignConfig({
                merchantId: "m1",
                campaignId: "c1",
                isDemoMode: false,
            })
        ).rejects.toThrow("Failed to load campaign");
    });

    it("getMerchantMembers throws instead of returning no members", async () => {
        membersPost.mockResolvedValue({ data: null, error: serverError });
        await expect(getMerchantMembers({}, false)).rejects.toThrow(
            "Failed to load members"
        );
    });
});
