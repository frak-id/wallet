import {
    isAndroid,
    isIOS,
    isTauri,
} from "@frak-labs/app-essentials/utils/platform";
import type { Address, Hex } from "viem";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebAuthNWallet } from "../../types/WebAuthN";
import {
    extractAuthError,
    getPlatformInfo,
    identifyAuthenticatedUser,
    openPanel,
    setProfileId,
    updateGlobalProperties,
} from "./index";

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
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("setProfileId", () => {
        it("sets the profile id on the openpanel instance", () => {
            if (!openPanel) return;
            setProfileId("test-profile-id");
            expect(openPanel.profileId).toBe("test-profile-id");
        });

        it("accepts undefined", () => {
            if (!openPanel) return;
            setProfileId(undefined);
            expect(openPanel.profileId).toBeUndefined();
        });
    });

    describe("getPlatformInfo", () => {
        beforeEach(() => {
            vi.mocked(isTauri).mockReturnValue(false);
            vi.mocked(isIOS).mockReturnValue(false);
            vi.mocked(isAndroid).mockReturnValue(false);
        });

        it("returns web platform when not in Tauri", () => {
            expect(getPlatformInfo()).toEqual({
                isTauri: false,
                platform: "web",
            });
        });

        it("returns ios when in Tauri iOS", () => {
            vi.mocked(isTauri).mockReturnValue(true);
            vi.mocked(isIOS).mockReturnValue(true);
            expect(getPlatformInfo()).toEqual({
                isTauri: true,
                platform: "ios",
            });
        });

        it("returns android when in Tauri Android", () => {
            vi.mocked(isTauri).mockReturnValue(true);
            vi.mocked(isAndroid).mockReturnValue(true);
            expect(getPlatformInfo()).toEqual({
                isTauri: true,
                platform: "android",
            });
        });

        it("returns unknown for desktop Tauri", () => {
            vi.mocked(isTauri).mockReturnValue(true);
            expect(getPlatformInfo()).toEqual({
                isTauri: true,
                platform: "unknown",
            });
        });
    });

    describe("updateGlobalProperties", () => {
        it("merges onto existing global props", () => {
            if (!openPanel) return;
            updateGlobalProperties({ wallet: "0x1234" as Address });
            expect(mockSetGlobalProperties).toHaveBeenCalledWith(
                expect.objectContaining({ wallet: "0x1234" })
            );
        });
    });

    describe("identifyAuthenticatedUser", () => {
        const baseSession: WebAuthNWallet = {
            type: "webauthn",
            address: "0x1234567890123456789012345678901234567890" as Address,
            publicKey: { x: "0xabc" as Hex, y: "0xdef" as Hex },
            authenticatorId: "auth-id",
        };

        it("updates wallet + session_id + identifies the profile + emits user_logged_in", () => {
            if (!openPanel) return;
            identifyAuthenticatedUser(baseSession);
            expect(mockSetGlobalProperties).toHaveBeenCalledWith(
                expect.objectContaining({ wallet: baseSession.address })
            );
            expect(mockIdentify).toHaveBeenCalledWith(
                expect.objectContaining({
                    profileId: baseSession.address,
                    properties: expect.objectContaining({
                        sessionType: "webauthn",
                    }),
                })
            );
            expect(mockTrack).toHaveBeenCalledWith("user_logged_in");
        });

        it("defaults sessionType to webauthn when absent", () => {
            if (!openPanel) return;
            const session = {
                ...baseSession,
                type: undefined,
            } as WebAuthNWallet;
            identifyAuthenticatedUser(session);
            expect(mockIdentify).toHaveBeenCalledWith(
                expect.objectContaining({
                    properties: expect.objectContaining({
                        sessionType: "webauthn",
                    }),
                })
            );
        });

        it("does NOT emit the domain _completed event", () => {
            if (!openPanel) return;
            identifyAuthenticatedUser(baseSession);
            const tracked = mockTrack.mock.calls.map((c) => c[0]);
            expect(tracked).toContain("user_logged_in");
            expect(tracked).not.toContain("login_completed");
            expect(tracked).not.toContain("register_completed");
        });
    });

    describe("extractAuthError", () => {
        it("pulls reason + error_type from a real Error", () => {
            const err = new TypeError("boom");
            expect(extractAuthError(err)).toEqual({
                reason: "boom",
                error_type: "TypeError",
            });
        });

        it("falls back to the name when the message is empty", () => {
            const err = new Error("");
            err.name = "CustomError";
            expect(extractAuthError(err)).toEqual({
                reason: "CustomError",
                error_type: "CustomError",
            });
        });

        it("accepts a string directly", () => {
            expect(extractAuthError("plain string")).toEqual({
                reason: "plain string",
                error_type: undefined,
            });
        });

        it("returns unknown for other shapes", () => {
            expect(extractAuthError({ nope: true })).toEqual({
                reason: "unknown",
                error_type: undefined,
            });
        });
    });
});
