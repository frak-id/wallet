import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setupReferral } from "./setup";

// Mock core SDK actions
vi.mock("@frak-labs/core-sdk/actions", () => ({
    referralInteraction: vi.fn(),
}));

describe("setup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Setup a mock client
        window.FrakSetup.client = {
            config: {
                metadata: {
                    name: "Test App",
                },
            },
        } as any;
    });

    describe("setupReferral", () => {
        it("should call referralInteraction", async () => {
            const mockReferral = { id: "test-referral" };
            vi.mocked(coreSdkActions.referralInteraction).mockResolvedValue(
                mockReferral as any
            );

            const consoleLogSpy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {});

            await setupReferral(window.FrakSetup.client!);

            expect(coreSdkActions.referralInteraction).toHaveBeenCalledWith(
                window.FrakSetup.client!
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                "referral",
                mockReferral
            );

            consoleLogSpy.mockRestore();
        });
    });
});
