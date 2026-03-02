import { describe, expect, it } from "vitest";
import { shouldShowOutletSkeleton } from "./navigationLoading";

describe("shouldShowOutletSkeleton", () => {
    it("returns false for same-route loading revalidations", () => {
        expect(
            shouldShowOutletSkeleton({
                currentPathname: "/app",
                navigationState: "loading",
                nextPathname: "/app",
            })
        ).toBe(false);
    });

    it("returns false for same-route submitting revalidations", () => {
        expect(
            shouldShowOutletSkeleton({
                currentPathname: "/app/settings/theme",
                navigationState: "submitting",
                nextPathname: "/app/settings/theme",
            })
        ).toBe(false);
    });

    it("returns true for route transitions", () => {
        expect(
            shouldShowOutletSkeleton({
                currentPathname: "/app",
                navigationState: "loading",
                nextPathname: "/app/campaigns",
            })
        ).toBe(true);
    });

    it("returns true for onboarding route transitions", () => {
        expect(
            shouldShowOutletSkeleton({
                currentPathname: "/app",
                navigationState: "loading",
                nextPathname: "/app/onboarding",
            })
        ).toBe(true);
    });

    it("returns false when next pathname is missing", () => {
        expect(
            shouldShowOutletSkeleton({
                currentPathname: "/app",
                navigationState: "loading",
                nextPathname: null,
            })
        ).toBe(false);
    });
});
