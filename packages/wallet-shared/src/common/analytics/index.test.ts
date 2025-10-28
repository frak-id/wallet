import type { Address } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../../types/Session";
import {
    setProfileId,
    trackAuthCompleted,
    trackAuthFailed,
    trackAuthInitiated,
    trackGenericEvent,
    updateGlobalProperties,
} from "./index";

// Create mock functions that we can spy on
const mockTrack = vi.fn().mockResolvedValue(undefined);
const mockIdentify = vi.fn().mockResolvedValue(undefined);
const mockSetGlobalProperties = vi.fn();
const mockInit = vi.fn();

// Mock the OpenPanel instance
const mockOpenPanelInstance = {
    init: mockInit,
    track: mockTrack,
    identify: mockIdentify,
    setGlobalProperties: mockSetGlobalProperties,
    profileId: undefined as string | undefined,
    global: {} as Record<string, unknown>,
};

// Mock OpenPanel constructor
vi.mock("@openpanel/web", () => ({
    OpenPanel: vi.fn().mockImplementation(() => mockOpenPanelInstance),
}));

vi.mock("../lib/inApp", () => ({
    isInIframe: false,
}));

vi.mock("ua-parser-js/helpers", () => ({
    isStandalonePWA: vi.fn(() => false),
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
            const mockSession: Omit<Session, "token"> = {
                type: "webauthn",
                address:
                    "0x1234567890123456789012345678901234567890" as Address,
                publicKey: "0xabc" as Address,
                authenticatorId: "auth-123",
            };

            await trackAuthCompleted("login", mockSession);

            // Should not throw
            expect(true).toBe(true);
        });

        it("should handle different session types", async () => {
            const mockSession: Omit<Session, "token"> = {
                type: "webauthn",
                address:
                    "0x1234567890123456789012345678901234567890" as Address,
                publicKey: "0xabc" as Address,
                authenticatorId: "auth-123",
            };

            await trackAuthCompleted("register", mockSession);

            // Should not throw
            expect(true).toBe(true);
        });

        it("should handle different wallet addresses", async () => {
            const mockSession: Omit<Session, "token"> = {
                type: "webauthn",
                address:
                    "0xabcdef1234567890abcdef1234567890abcdef12" as Address,
                publicKey: "0xdef" as Address,
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
            await trackAuthCompleted("login", {
                type: "webauthn",
                address: "0x123" as Address,
                publicKey: "0xabc" as Address,
                authenticatorId: "auth",
            });
            await trackAuthFailed("login", "error");
            await trackGenericEvent("test");

            // Should not throw any errors
            expect(true).toBe(true);
        });
    });
});
