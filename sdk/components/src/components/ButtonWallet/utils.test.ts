import { beforeEach, describe, expect, it, vi } from "vitest";
import * as sharingPageUtils from "@/actions/sharingPage";
import * as safeVibrateUtils from "@/utils/browser/safeVibrate";
import { openWalletModal } from "./utils";

vi.mock("@/actions/sharingPage", () => ({
    openSharingPage: vi.fn(),
}));

vi.mock("@/utils/browser/safeVibrate", () => ({
    safeVibrate: vi.fn(),
}));

describe("openWalletModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call safeVibrate and openSharingPage", () => {
        openWalletModal();

        expect(safeVibrateUtils.safeVibrate).toHaveBeenCalledTimes(1);
        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            undefined,
            undefined
        );
    });

    it("should pass targetInteraction to openSharingPage", () => {
        openWalletModal("custom.customerMeeting");

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            "custom.customerMeeting",
            undefined
        );
    });

    it("should pass targetInteraction and placement to openSharingPage", () => {
        openWalletModal("custom.customerMeeting", "hero");

        expect(sharingPageUtils.openSharingPage).toHaveBeenCalledWith(
            "custom.customerMeeting",
            "hero"
        );
    });
});
