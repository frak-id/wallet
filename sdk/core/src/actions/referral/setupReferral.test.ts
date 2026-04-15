import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REFERRAL_SUCCESS_EVENT, setupReferral } from "./setupReferral";

vi.mock("./referralInteraction", () => ({
    referralInteraction: vi.fn(),
}));

import { referralInteraction } from "./referralInteraction";

describe("setupReferral", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should dispatch referral success event on successful referral", async () => {
        vi.mocked(referralInteraction).mockResolvedValue("success");
        const listener = vi.fn();
        window.addEventListener(REFERRAL_SUCCESS_EVENT, listener);

        await setupReferral({ config: {} } as any);

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener).toHaveBeenCalledWith(expect.any(Event));

        window.removeEventListener(REFERRAL_SUCCESS_EVENT, listener);
    });

    it("should not dispatch event when referral state is not success", async () => {
        vi.mocked(referralInteraction).mockResolvedValue("no-referrer");
        const listener = vi.fn();
        window.addEventListener(REFERRAL_SUCCESS_EVENT, listener);

        await setupReferral({ config: {} } as any);

        expect(listener).not.toHaveBeenCalled();

        window.removeEventListener(REFERRAL_SUCCESS_EVENT, listener);
    });

    it("should not dispatch event when referral returns undefined", async () => {
        vi.mocked(referralInteraction).mockResolvedValue(undefined);
        const listener = vi.fn();
        window.addEventListener(REFERRAL_SUCCESS_EVENT, listener);

        await setupReferral({ config: {} } as any);

        expect(listener).not.toHaveBeenCalled();

        window.removeEventListener(REFERRAL_SUCCESS_EVENT, listener);
    });

    it("should silently catch errors and log warning", async () => {
        vi.mocked(referralInteraction).mockRejectedValue(
            new Error("network failure")
        );
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const listener = vi.fn();
        window.addEventListener(REFERRAL_SUCCESS_EVENT, listener);

        await setupReferral({ config: {} } as any);

        expect(listener).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
            "[Frak] Referral setup failed",
            expect.any(Error)
        );

        window.removeEventListener(REFERRAL_SUCCESS_EVENT, listener);
        warnSpy.mockRestore();
    });

    it("should export the correct event name constant", () => {
        expect(REFERRAL_SUCCESS_EVENT).toBe("frak:referral-success");
    });
});
