import { beforeEach, describe, expect, it, vi } from "vitest";
import * as embeddedWalletUtils from "@/actions/embeddedWallet";
import * as safeVibrateUtils from "@/utils/browser/safeVibrate";
import { openWalletModal } from "./utils";

vi.mock("@/actions/embeddedWallet", () => ({
    openEmbeddedWallet: vi.fn(),
}));

vi.mock("@/utils/browser/safeVibrate", () => ({
    safeVibrate: vi.fn(),
}));

describe("openWalletModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should call safeVibrate and openEmbeddedWallet", () => {
        openWalletModal();

        expect(safeVibrateUtils.safeVibrate).toHaveBeenCalledTimes(1);
        expect(embeddedWalletUtils.openEmbeddedWallet).toHaveBeenCalledWith(
            undefined,
            undefined
        );
    });

    it("should pass targetInteraction to openEmbeddedWallet", () => {
        openWalletModal("custom.customerMeeting");

        expect(embeddedWalletUtils.openEmbeddedWallet).toHaveBeenCalledWith(
            "custom.customerMeeting",
            undefined
        );
    });

    it("should pass targetInteraction and placement to openEmbeddedWallet", () => {
        openWalletModal("custom.customerMeeting", "hero");

        expect(embeddedWalletUtils.openEmbeddedWallet).toHaveBeenCalledWith(
            "custom.customerMeeting",
            "hero"
        );
    });
});
