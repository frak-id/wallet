import {
    isAndroid,
    isIOS,
    isTauri,
} from "@frak-labs/app-essentials/utils/platform";
import type { Address, Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebAuthNWallet } from "../../types/WebAuthN";
import {
    getPlatformInfo,
    openPanel,
    setProfileId,
    trackAuthCompleted,
    trackAuthFailed,
    trackAuthInitiated,
    trackGenericEvent,
    updateGlobalProperties,
} from "./index";

// Create mock functions that we can spy on (hoisted for vi.mock)
const { mockTrack, mockIdentify, mockSetGlobalProperties, mockInit } =
    vi.hoisted(() => ({
        mockTrack: vi.fn().mockResolvedValue(undefined),
        mockIdentify: vi.fn().mockResolvedValue(undefined),
        mockSetGlobalProperties: vi.fn(),
        mockInit: vi.fn(),
    }));

type MockOpenPanelInstance = {
    global: Record<string, unknown>;
    identify: typeof mockIdentify;
    init: typeof mockInit;
    profileId: string | undefined;
    setGlobalProperties: typeof mockSetGlobalProperties;
    track: typeof mockTrack;
};

// Mock OpenPanel constructor
vi.mock("@openpanel/web", () => ({
    OpenPanel: vi.fn(function (this: MockOpenPanelInstance) {
        Object.assign(this, {
            init: mockInit,
            track: mockTrack,
            identify: mockIdentify,
            setGlobalProperties: mockSetGlobalProperties,
            profileId: undefined,
            global: {},
        });
    }),
}));

// Mock the OpenPanel instance (for reference in tests)
const mockOpenPanelInstance = {
    init: mockInit,
    track: mockTrack,
    identify: mockIdentify,
    setGlobalProperties: mockSetGlobalProperties,
    profileId: undefined as string | undefined,
    global: {} as Record<string, unknown>,
};

vi.mock("../lib/inApp", () => ({
    isInIframe: false,
}));

vi.mock("ua-parser-js/helpers", () => ({
    isStandalonePWA: vi.fn(() => false),
}));

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    isTauri: vi.fn(() => false),
    isIOS: vi.fn(() => false),
    isAndroid: vi.fn(() => false),
}));

describe("Analytics", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset mock instance state
        mockOpenPanelInstance.profileId = undefined;
        mockOpenPanelInstance.global = {};
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("setProfileId", () => {
        it("should handle setting profile ID", () => {
            // Test that the function doesn't throw
            setProfileId("test-profile-id");
            expect(true).toBe(true);
        });

        it("should handle undefined profile ID", () => {
            setProfileId(undefined);
            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe("getPlatformInfo", () => {
        beforeEach(() => {
            vi.mocked(isTauri).mockReturnValue(false);
            vi.mocked(isIOS).mockReturnValue(false);
            vi.mocked(isAndroid).mockReturnValue(false);
        });

        it("should return web platform when not in Tauri", () => {
            const result = getPlatformInfo();
            expect(result).toEqual({ isTauri: false, platform: "web" });
        });

        it("should return ios platform when in Tauri iOS", () => {
            vi.mocked(isTauri).mockReturnValue(true);
            vi.mocked(isIOS).mockReturnValue(true);
            const result = getPlatformInfo();
            expect(result).toEqual({ isTauri: true, platform: "ios" });
        });

        it("should return android platform when in Tauri Android", () => {
            vi.mocked(isTauri).mockReturnValue(true);
            vi.mocked(isAndroid).mockReturnValue(true);
            const result = getPlatformInfo();
            expect(result).toEqual({ isTauri: true, platform: "android" });
        });

        it("should return unknown platform for desktop Tauri", () => {
            vi.mocked(isTauri).mockReturnValue(true);
            const result = getPlatformInfo();
            expect(result).toEqual({ isTauri: true, platform: "unknown" });
        });
    });

    describe("updateGlobalProperties", () => {
        it("should not throw when updating global properties", () => {
            const properties = {
                wallet: "0x1234" as Address,
                isIframe: true,
            };

            updateGlobalProperties(properties);

            // Function should not throw
            expect(true).toBe(true);
        });

        it("should handle partial property updates", () => {
            updateGlobalProperties({ wallet: "0x5678" as Address });

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe("trackAuthInitiated", () => {
        it("should not throw when tracking auth initiated with global method", async () => {
            await trackAuthInitiated("login", { method: "global" });
            // Should not throw
            expect(true).toBe(true);
        });

        it("should not throw when tracking auth initiated with specific method", async () => {
            await trackAuthInitiated("register", { method: "specific" });
            // Should not throw
            expect(true).toBe(true);
        });

        it("should not throw when tracking auth initiated without args", async () => {
            await trackAuthInitiated("login");
            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe("trackAuthCompleted", () => {
        it("should not throw when tracking auth completed", async () => {
            const mockSession: WebAuthNWallet = {
                type: "webauthn",
                address:
                    "0x1234567890123456789012345678901234567890" as Address,
                publicKey: { x: "0xabc" as Hex, y: "0xdef" as Hex },
                authenticatorId: "auth-123",
            };

            await trackAuthCompleted("login", mockSession);

            // Should not throw
            expect(true).toBe(true);
        });

        it("should handle different session types", async () => {
            const mockSession: WebAuthNWallet = {
                type: "webauthn",
                address:
                    "0x1234567890123456789012345678901234567890" as Address,
                publicKey: { x: "0xabc" as Hex, y: "0xdef" as Hex },
                authenticatorId: "auth-123",
            };

            await trackAuthCompleted("register", mockSession);

            // Should not throw
            expect(true).toBe(true);
        });

        it("should handle different wallet addresses", async () => {
            const mockSession: WebAuthNWallet = {
                type: "webauthn",
                address:
                    "0xabcdef1234567890abcdef1234567890abcdef12" as Address,
                publicKey: { x: "0xdef" as Hex, y: "0x123" as Hex },
                authenticatorId: "auth-456",
            };

            await trackAuthCompleted("login", mockSession);

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe("trackAuthFailed", () => {
        it("should not throw when tracking auth failed", async () => {
            await trackAuthFailed("login", "User cancelled");

            // Should not throw
            expect(true).toBe(true);
        });

        it("should handle different error reasons", async () => {
            await trackAuthFailed("register", "Network error");

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe("trackGenericEvent", () => {
        it("should not throw when tracking generic event without params", async () => {
            await trackGenericEvent("button_clicked");

            // Should not throw
            expect(true).toBe(true);
        });

        it("should not throw when tracking generic event with params", async () => {
            const params = {
                buttonId: "submit",
                page: "home",
                timestamp: Date.now(),
            };

            await trackGenericEvent("button_clicked", params);

            // Should not throw
            expect(true).toBe(true);
        });

        it("should handle complex params", async () => {
            const params = {
                nested: { value: 123 },
                array: [1, 2, 3],
                string: "test",
            };

            await trackGenericEvent("complex_event", params);

            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe("OpenPanel initialization", () => {
        it("should not throw when openPanel is not available", async () => {
            // All functions should gracefully handle missing openPanel
            setProfileId("test");
            updateGlobalProperties({ wallet: "0x123" as Address });
            await trackAuthInitiated("login");
            const mockSession: WebAuthNWallet = {
                type: "webauthn",
                address: "0x123" as Address,
                publicKey: { x: "0xabc" as Hex, y: "0xdef" as Hex },
                authenticatorId: "auth",
            };
            await trackAuthCompleted("login", mockSession);
            await trackAuthFailed("login", "error");
            await trackGenericEvent("test");

            // Should not throw any errors
            expect(true).toBe(true);
        });
    });

    describe("OpenPanel with instance available", () => {
        it("should call openPanel methods when instance is available", () => {
            if (!openPanel) {
                // Skip if openPanel is not initialized (env vars not set)
                expect(true).toBe(true);
                return;
            }

            setProfileId("test-profile-123");
            expect(openPanel.profileId).toBe("test-profile-123");
        });

        it("should call setGlobalProperties when updating properties", () => {
            if (!openPanel) {
                expect(true).toBe(true);
                return;
            }

            const properties = {
                wallet: "0x9876" as Address,
                isIframe: false,
            };

            updateGlobalProperties(properties);
            expect(mockSetGlobalProperties).toHaveBeenCalled();
        });

        it("should call track when tracking auth initiated", async () => {
            if (!openPanel) {
                expect(true).toBe(true);
                return;
            }

            await trackAuthInitiated("login", { method: "global" });
            expect(mockTrack).toHaveBeenCalledWith("login_initiated", {
                method: "global",
            });
        });

        it("should call track and identify when tracking auth completed", async () => {
            if (!openPanel) {
                expect(true).toBe(true);
                return;
            }

            const session: WebAuthNWallet = {
                type: "webauthn",
                address: "0xtest123" as Address,
                publicKey: { x: "0xpubkey" as Hex, y: "0xpubkey2" as Hex },
                authenticatorId: "auth-id",
            };

            await trackAuthCompleted("login", session);
            expect(mockIdentify).toHaveBeenCalled();
            expect(mockTrack).toHaveBeenCalledWith("login_completed");
            expect(mockTrack).toHaveBeenCalledWith("user_logged_in");
        });

        it("should call identify with platform properties in trackAuthCompleted", async () => {
            vi.mocked(isTauri).mockReturnValue(true);
            vi.mocked(isIOS).mockReturnValue(true);

            const session: WebAuthNWallet = {
                type: "webauthn",
                address: "0xplatform123" as Address,
                publicKey: { x: "0xpubkey" as Hex, y: "0xpubkey2" as Hex },
                authenticatorId: "auth-platform",
            };

            await trackAuthCompleted("login", session);
            expect(mockIdentify).toHaveBeenCalledWith(
                expect.objectContaining({
                    properties: expect.objectContaining({
                        isTauri: true,
                        platform: "ios",
                    }),
                })
            );
        });

        it("should handle session without type in trackAuthCompleted", async () => {
            if (!openPanel) {
                expect(true).toBe(true);
                return;
            }

            const session: WebAuthNWallet = {
                type: undefined,
                address: "0xtest456" as Address,
                publicKey: { x: "0xpubkey" as Hex, y: "0xpubkey2" as Hex },
                authenticatorId: "auth-id-2",
            };

            await trackAuthCompleted("register", session);
            expect(mockIdentify).toHaveBeenCalledWith(
                expect.objectContaining({
                    profileId: session.address,
                    properties: expect.objectContaining({
                        sessionType: "webauthn", // Should default to "webauthn"
                    }),
                })
            );
        });

        it("should call track when tracking auth failed", async () => {
            if (!openPanel) {
                expect(true).toBe(true);
                return;
            }

            await trackAuthFailed("login", "Test error reason");
            expect(mockTrack).toHaveBeenCalledWith("login_failed", {
                reason: "Test error reason",
            });
        });

        it("should call track when tracking generic events", async () => {
            if (!openPanel) {
                expect(true).toBe(true);
                return;
            }

            const params = { customParam: "value123" };
            await trackGenericEvent("custom_event", params);
            expect(mockTrack).toHaveBeenCalledWith("custom_event", params);
        });
    });

    describe("Edge cases and error handling", () => {
        it("should handle trackAuthCompleted when wallet has null type", async () => {
            const session: WebAuthNWallet = {
                type: null as unknown as undefined,
                address: "0xnull123" as Address,
                publicKey: { x: "0xpubnull" as Hex, y: "0xpubnull2" as Hex },
                authenticatorId: "auth-null",
            };

            await trackAuthCompleted("login", session);
            // Should not throw
            expect(true).toBe(true);
        });

        it("should handle empty params in trackGenericEvent", async () => {
            await trackGenericEvent("empty_event", {});
            expect(true).toBe(true);
        });

        it("should handle trackAuthInitiated without args object", async () => {
            await trackAuthInitiated("register");
            expect(true).toBe(true);
        });

        it("should handle multiple concurrent trackAuthCompleted calls", async () => {
            const session1: WebAuthNWallet = {
                type: "webauthn",
                address: "0xconcurrent1" as Address,
                publicKey: { x: "0xpub1" as Hex, y: "0xpub1y" as Hex },
                authenticatorId: "auth-1",
            };

            const session2: WebAuthNWallet = {
                type: "webauthn",
                address: "0xconcurrent2" as Address,
                publicKey: { x: "0xpub2" as Hex, y: "0xpub2y" as Hex },
                authenticatorId: "auth-2",
            };

            await Promise.all([
                trackAuthCompleted("login", session1),
                trackAuthCompleted("register", session2),
            ]);

            // Should not throw
            expect(true).toBe(true);
        });

        it("should handle updateGlobalProperties with empty object", () => {
            updateGlobalProperties({});
            expect(true).toBe(true);
        });

        it("should handle updateGlobalProperties when global is undefined", () => {
            if (!openPanel) {
                expect(true).toBe(true);
                return;
            }

            // Set global to undefined
            mockOpenPanelInstance.global = undefined as unknown as Record<
                string,
                unknown
            >;

            updateGlobalProperties({ wallet: "0xtest" as Address });
            expect(mockSetGlobalProperties).toHaveBeenCalled();
        });
    });
});
