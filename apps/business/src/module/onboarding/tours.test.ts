import { describe, expect, it } from "vitest";
import type { TourId } from "@/stores/onboardingTourStore";
import { canAutoStartOn, canOpenFullTour, resolveTourId } from "./tours";

describe("resolveTourId", () => {
    it.each([
        ["/dashboard", "stores"],
        ["/m/store-1/dashboard", "stores"],
        ["/m/store-1/merchant/funding", "stores"],
        ["/m/store-1/campaigns", "campaignsOverview"],
        ["/m/store-1/campaigns/", "campaignsOverview"],
        ["/m/store-1/campaigns/list", "campaignsList"],
        ["/m/store-1/campaigns/draft/new", "campaignWizard"],
        ["/m/store-1/campaigns/draft/abc", "campaignWizard"],
        ["/m/store-1/campaigns/draft/abc/goals", "campaignWizard"],
        ["/m/store-1/campaigns/draft/abc/territory", "campaignWizard"],
        ["/m/store-1/campaigns/draft/abc/products", "campaignWizard"],
        ["/m/store-1/campaigns/draft/abc/referral-chain", "campaignWizard"],
        ["/m/store-1/campaigns/draft/abc/budget", "campaignWizardBudget"],
        ["/m/store-1/campaigns/draft/abc/budget/", "campaignWizardBudget"],
        ["/m/store-1/campaigns/draft/abc/reward", "campaignWizardReward"],
        ["/m/store-1/campaigns/draft/abc/validation", "campaignWizardReview"],
        ["/campaigns/draft/abc/validation", "campaignWizardReview"],
        ["/merchant/new", "storeWizard"],
        ["/m/store-1/members", "members"],
        ["/m/store-1/push", "push"],
        ["/m/store-1/push/create", "pushCreate"],
        ["/m/store-1/merchant", "storeEdit"],
        ["/m/store-1/merchant/team", "storeEdit"],
        ["/m/store-1/merchant/customize", "storeEdit"],
        ["/m/store-1/merchant/setup-status", "setupStatus"],
        ["/settings", "settings"],
        ["/settings/billing", "billing"],
    ])("maps %s to the %s tour", (pathname, tourId) => {
        expect(resolveTourId(pathname)).toBe(tourId);
    });

    it.each([
        "/m/store-1/campaigns/affiliate-report",
        "/m/store-1/campaigns/abc",
    ])("has no tour on %s", (pathname) => {
        expect(resolveTourId(pathname)).toBeNull();
    });

    it("has no tour on Frak staff pages", () => {
        expect(resolveTourId("/internal")).toBeNull();
        expect(resolveTourId("/internal/bank")).toBeNull();
    });

    it("falls back to the welcome tour on other pages", () => {
        expect(resolveTourId("/something-else")).toBe("welcome");
    });
});

describe("canOpenFullTour", () => {
    it.each<TourId>([
        "stores",
        "campaignsOverview",
        "campaignsList",
        "members",
        "push",
        "setupStatus",
        "settings",
        "billing",
    ])("is offered on the %s tour", (tourId) => {
        expect(canOpenFullTour(tourId)).toBe(true);
    });

    it.each<TourId>([
        "welcome",
        "campaignWizard",
        "campaignWizardBudget",
        "campaignWizardReward",
        "campaignWizardReview",
        "storeWizard",
        "storeEdit",
        "pushCreate",
    ])("is not offered on the %s tour", (tourId) => {
        expect(canOpenFullTour(tourId)).toBe(false);
    });
});

describe("canAutoStartOn", () => {
    it("only allows pages without a sheet or a wizard", () => {
        expect(canAutoStartOn("/m/store-1/dashboard")).toBe(true);
        expect(canAutoStartOn("/m/store-1/campaigns")).toBe(true);
        expect(canAutoStartOn("/m/store-1/members")).toBe(true);
        expect(canAutoStartOn("/m/store-1/merchant/funding")).toBe(false);
        expect(canAutoStartOn("/m/store-1/campaigns/draft/new")).toBe(false);
        expect(canAutoStartOn("/settings")).toBe(false);
        expect(canAutoStartOn("/internal")).toBe(false);
    });
});
