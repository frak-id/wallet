import { describe, expect, it } from "vitest";
import { ambassadorResultToast } from "./useAmbassadorPage";

describe("ambassadorResultToast", () => {
    it.each([
        ["publish", "ambassadorPage.toast.published"],
        ["switch", "ambassadorPage.toast.switched"],
        ["hide", "ambassadorPage.toast.hidden"],
        ["addToMenu", "ambassadorPage.toast.menuAdded"],
    ] as const)("confirms a successful %s", (intent, key) => {
        expect(ambassadorResultToast({ ok: true, intent })).toEqual({
            key,
            isError: false,
        });
    });

    it("keeps the success toast when only warnings came back", () => {
        expect(
            ambassadorResultToast({
                ok: true,
                intent: "hide",
                warnings: ["menuRemoveFailed"],
            })
        ).toEqual({ key: "ambassadorPage.toast.hidden", isError: false });
    });

    it("reports, without an error toast, a menu link that could not be added after publishing", () => {
        expect(
            ambassadorResultToast({
                ok: true,
                intent: "publish",
                url: "https://shop.test/apps/ambassador",
                menu: "failed",
            })
        ).toEqual({ key: "ambassadorPage.toast.menuFailed", isError: false });
    });

    it("asks for the permission on scopeMissing", () => {
        expect(
            ambassadorResultToast({
                ok: false,
                intent: "publish",
                error: "scopeMissing",
            })
        ).toEqual({
            key: "ambassadorPage.toast.permissionNeeded",
            isError: true,
        });
    });

    it.each(["failed", "invalid"] as const)(
        "shows the generic error on %s",
        (error) => {
            expect(
                ambassadorResultToast({ ok: false, intent: "switch", error })
            ).toEqual({ key: "ambassadorPage.toast.failed", isError: true });
        }
    );
});
