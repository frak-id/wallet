import * as coreSdkActions from "@frak-labs/core-sdk/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getModalBuilderSteps, setupModalConfig, setupReferral } from "./setup";

// Mock core SDK actions
vi.mock("@frak-labs/core-sdk/actions", () => ({
    modalBuilder: vi.fn(),
    referralInteraction: vi.fn(),
}));

describe("setup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.modalBuilderSteps = undefined;
        // Setup a mock client
        window.FrakSetup.client = {
            config: {
                metadata: {
                    name: "Test App",
                },
            },
        } as any;
    });

    describe("setupModalConfig", () => {
        it("should create modal builder steps", () => {
            const mockModalBuilder = vi.fn().mockReturnValue({});
            vi.mocked(coreSdkActions.modalBuilder).mockImplementation(
                mockModalBuilder
            );

            setupModalConfig(window.FrakSetup.client!);

            expect(coreSdkActions.modalBuilder).toHaveBeenCalledWith(
                window.FrakSetup.client!,
                window.FrakSetup.modalConfig ?? {}
            );
            expect(window.modalBuilderSteps).toBeDefined();
        });

        it("should use modalConfig when provided", () => {
            const customConfig = { metadata: { position: "left" as const } };
            window.FrakSetup.modalConfig = customConfig as any;
            const mockModalBuilder = vi.fn().mockReturnValue({});
            vi.mocked(coreSdkActions.modalBuilder).mockImplementation(
                mockModalBuilder
            );

            setupModalConfig(window.FrakSetup.client!);

            expect(coreSdkActions.modalBuilder).toHaveBeenCalledWith(
                window.FrakSetup.client!,
                customConfig
            );
        });
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
                window.FrakSetup.client!,
                {
                    modalConfig: window.FrakSetup.modalWalletConfig,
                }
            );
            expect(consoleLogSpy).toHaveBeenCalledWith(
                "referral",
                mockReferral
            );

            consoleLogSpy.mockRestore();
        });
    });

    describe("getModalBuilderSteps", () => {
        it("should return modal builder steps when available", () => {
            const mockSteps = { sharing: vi.fn() };
            window.modalBuilderSteps = mockSteps as any;

            const result = getModalBuilderSteps();

            expect(result).toBe(mockSteps);
        });

        it("should throw error when modal builder steps are not available", () => {
            window.modalBuilderSteps = undefined;

            expect(() => getModalBuilderSteps()).toThrow(
                "modalBuilderSteps not found"
            );
        });
    });
});
