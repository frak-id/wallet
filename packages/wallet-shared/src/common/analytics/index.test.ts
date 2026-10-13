import type { Address, Hex } from "viem";
import {
    afterEach,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";
import type { WebAuthNWallet } from "../../types/WebAuthN";
import {
    extractAuthError,
    getPlatformInfo,
    identifyAuthenticatedUser,
    initAnalytics,
    openPanel,
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

const platformMocks = vi.hoisted(() => ({
    isTauri: vi.fn(() => false),
    isIOS: vi.fn(() => false),
    isAndroid: vi.fn(() => false),
    isStandalonePwa: vi.fn(() => false),
}));
vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_TAURI() {
        return platformMocks.isTauri();
    },
    get IS_IOS() {
        return platformMocks.isIOS();
    },
    get IS_ANDROID() {
        return platformMocks.isAndroid();
    },
    isStandalonePwa: () => platformMocks.isStandalonePwa(),
}));

describe("Analytics", () => {
    // Every assertion below goes through the instance; `apps-setup` stubs the
    // env that builds it, so a missing one must fail here and not silently.
    beforeAll(() => {
        expect(openPanel).toBeDefined();
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("getPlatformInfo", () => {
        beforeEach(() => {
            platformMocks.isTauri.mockReturnValue(false);
            platformMocks.isIOS.mockReturnValue(false);
            platformMocks.isAndroid.mockReturnValue(false);
        });

        it("returns web platform when not in Tauri", () => {
            expect(getPlatformInfo()).toEqual({
                isTauri: false,
                platform: "web",
            });
        });

        it("returns ios when in Tauri iOS", () => {
            platformMocks.isTauri.mockReturnValue(true);
            platformMocks.isIOS.mockReturnValue(true);
            expect(getPlatformInfo()).toEqual({
                isTauri: true,
                platform: "ios",
            });
        });

        it("returns android when in Tauri Android", () => {
            platformMocks.isTauri.mockReturnValue(true);
            platformMocks.isAndroid.mockReturnValue(true);
            expect(getPlatformInfo()).toEqual({
                isTauri: true,
                platform: "android",
            });
        });

        it("returns unknown for desktop Tauri", () => {
            platformMocks.isTauri.mockReturnValue(true);
            expect(getPlatformInfo()).toEqual({
                isTauri: true,
                platform: "unknown",
            });
        });
    });

    describe("updateGlobalProperties", () => {
        it("forwards to setGlobalProperties, which merges", () => {
            updateGlobalProperties({ wallet: "0x1234" as Address });
            expect(mockSetGlobalProperties).toHaveBeenCalledWith(
                expect.objectContaining({ wallet: "0x1234" })
            );
        });
    });

    describe("initAnalytics", () => {
        it("keys the wallet profile on the install id before any event", () => {
            initAnalytics("wallet");
            expect(openPanel?.profileId).toBe(
                window.localStorage.getItem("frak_analytics_install_id")
            );
            expect(mockSetGlobalProperties).toHaveBeenCalledWith(
                expect.objectContaining({ __deviceId: expect.any(String) })
            );
        });

        it("adopts the host id on a hosted surface, in the init props too", () => {
            initAnalytics("listener", { hostAnonymousId: "sdk-anon" });
            expect(openPanel?.profileId).toBe("sdk-anon");
            expect(mockSetGlobalProperties).toHaveBeenCalledWith(
                expect.objectContaining({
                    surface: "listener",
                    __deviceId: "sdk-anon",
                })
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

        it("sets the wallet property, identifies the anonymous profile and emits user_logged_in", () => {
            identifyAuthenticatedUser(baseSession);
            expect(mockSetGlobalProperties).toHaveBeenCalledWith(
                expect.objectContaining({ wallet: baseSession.address })
            );
            expect(mockIdentify).toHaveBeenCalledWith(
                expect.objectContaining({
                    profileId: openPanel?.profileId,
                    properties: expect.objectContaining({
                        session_type: "webauthn",
                    }),
                })
            );
            expect(openPanel?.profileId).not.toBe(baseSession.address);
            expect(mockTrack).toHaveBeenCalledWith("user_logged_in");
        });

        it("defaults session_type to webauthn when absent", () => {
            const session = {
                ...baseSession,
                address: "0x2222222222222222222222222222222222222222",
                type: undefined,
            } as WebAuthNWallet;
            identifyAuthenticatedUser(session);
            expect(mockIdentify).toHaveBeenCalledWith(
                expect.objectContaining({
                    properties: expect.objectContaining({
                        session_type: "webauthn",
                    }),
                })
            );
        });

        it("does NOT emit the domain _completed event", () => {
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
