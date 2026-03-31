import { beforeEach, describe, expect, it, vi } from "vitest";
import * as embeddedWalletUtils from "@/utils/embeddedWallet";
import * as safeVibrateUtils from "@/utils/safeVibrate";
import { openWalletModal } from "./utils";

vi.mock("@/utils/embeddedWallet", () => ({
    openEmbeddedWallet: vi.fn(),
}));

vi.mock("@/utils/safeVibrate", () => ({
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
