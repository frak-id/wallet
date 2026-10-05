import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAmbassadorPageStatus } from "../services.server/ambassadorPage";
import { doesThemeHasFrakBanner } from "../services.server/theme";
import type { AuthenticatedContext } from "../types/context";
import { fetchAllOnboardingData } from "./onboarding.server";

vi.mock("../services.server/logger", () => ({
    log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));
vi.mock("../services.server/ambassadorPage", () => ({
    getAmbassadorPageStatus: vi.fn(),
}));
vi.mock("../services.server/backendMerchant", () => ({
    getFrakWebhookStatus: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services.server/merchant", () => ({
    resolveMerchantId: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services.server/shop", () => ({
    firstProductPublished: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services.server/theme", () => ({
    doesThemeHasFrakActivated: vi.fn().mockResolvedValue(undefined),
    doesThemeHasFrakBanner: vi.fn(),
    doesThemeHasFrakButton: vi.fn().mockResolvedValue(undefined),
    getMainThemeId: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services.server/webhook", () => ({
    getWebhooks: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../services.server/webPixel", () => ({
    getWebPixel: vi.fn().mockResolvedValue(undefined),
}));

const context = {} as AuthenticatedContext;
const request = new Request("https://app.test/app");

beforeEach(() => {
    vi.mocked(doesThemeHasFrakBanner).mockReset();
    vi.mocked(getAmbassadorPageStatus).mockReset();
});

describe("fetchAllOnboardingData", () => {
    it("keeps the ambassador status when the banner scan throws", async () => {
        vi.mocked(doesThemeHasFrakBanner).mockRejectedValue(new Error("boom"));
        vi.mocked(getAmbassadorPageStatus).mockResolvedValue("live");

        const data = await fetchAllOnboardingData(context, request);

        expect(data.ambassadorPage).toBe("live");
        expect(data).not.toHaveProperty("isThemeHasFrakBanner");
    });

    it("keeps the banner scan when the ambassador status is unreadable", async () => {
        vi.mocked(doesThemeHasFrakBanner).mockResolvedValue(true);
        vi.mocked(getAmbassadorPageStatus).mockResolvedValue(undefined);

        const data = await fetchAllOnboardingData(context, request);

        expect(data.isThemeHasFrakBanner).toBe(true);
        expect(data).not.toHaveProperty("ambassadorPage");
    });
});
