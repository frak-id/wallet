import { describe, expect, it } from "vitest";
import { canAutoStartOn, resolveTourId } from "./tours";

describe("resolveTourId", () => {
    it.each([
        ["/dashboard", "stores"],
        ["/m/store-1/dashboard", "stores"],
        ["/m/store-1/merchant/funding", "stores"],
        ["/m/store-1/campaigns", "campaignsOverview"],
        ["/m/store-1/campaigns/", "campaignsOverview"],
        ["/m/store-1/campaigns/list", "campaignsList"],
        ["/m/store-1/campaigns/draft/new", "campaignWizard"],
        ["/m/store-1/campaigns/draft/abc/budget", "campaignWizard"],
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

    it("has no tour on Frak staff pages", () => {
        expect(resolveTourId("/internal")).toBeNull();
        expect(resolveTourId("/internal/bank")).toBeNull();
    });

    it("falls back to the welcome tour on other pages", () => {
        expect(resolveTourId("/something-else")).toBe("welcome");
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
