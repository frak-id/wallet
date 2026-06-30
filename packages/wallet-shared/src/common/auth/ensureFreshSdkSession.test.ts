import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SdkSession } from "../../types/Session";

// ------------------------------------------------------------------
// Hoisted mocks (must match what ensureFreshSdkSession imports)
// ------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
    getSafeSdkSession: vi.fn<() => SdkSession | null>(),
    getSafeSession: vi.fn<() => { token: string } | null>(),
    setSdkSession: vi.fn(),
    sessionStoreGetState: vi.fn(),
    expiresWithinMs: vi.fn<(token: string, windowMs: number) => boolean>(),
    getTokenExpMs: vi.fn<(token: string) => number | null>(),
    generateGet: vi.fn(),
}));

vi.mock("../../stores/sessionStore", () => ({
    sessionStore: {
        getState: mocks.sessionStoreGetState,
    },
}));
vi.mock("../utils/safeSession", () => ({
    getSafeSdkSession: mocks.getSafeSdkSession,
    getSafeSession: mocks.getSafeSession,
}));
vi.mock("../utils/tokenExpiry", () => ({
    expiresWithinMs: mocks.expiresWithinMs,
    getTokenExpMs: mocks.getTokenExpMs,
    SDK_RENEW_BEFORE_MS: 7_200_000, // 2h
}));
vi.mock("../api/backendClient", () => ({
    authenticatedWalletApi: {
        auth: {
            sdk: {
                generate: { get: mocks.generateGet },
            },
        },
    },
}));

// ------------------------------------------------------------------

const FRESH_SDK: SdkSession = {
    token: "fresh-token",
    expires: Date.now() + 86_400_000,
};
const CURRENT_SDK: SdkSession = {
    token: "current-token",
    expires: Date.now() + 3_600_000,
};

describe("ensureFreshSdkSession", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: tokens are decodable (non-null expiry). Individual tests
        // override this to exercise the corrupt-token path.
        mocks.getTokenExpMs.mockReturnValue(Date.now() + 86_400_000);
        mocks.sessionStoreGetState.mockReturnValue({
            sdkSession: null,
            setSdkSession: mocks.setSdkSession,
        });
    });

    it("returns fresh immediately when token is not near expiry (no network call)", async () => {
        mocks.getSafeSdkSession.mockReturnValue(CURRENT_SDK);
        mocks.expiresWithinMs.mockReturnValue(false); // not near expiry

        const { ensureFreshSdkSession } = await import(
            "./ensureFreshSdkSession"
        );
        const result = await ensureFreshSdkSession();

        expect(result).toEqual({ status: "fresh", sdk: CURRENT_SDK });
        expect(mocks.generateGet).not.toHaveBeenCalled();
    });

    it("does NOT early-return a corrupt/undecodable token as fresh; attempts remint", async () => {
        // Garbage token: expiresWithinMs fails open (false), but the expiry is
        // undecodable (null). Must NOT be cached as "fresh" — fall through to
        // the server remint path (authority principle).
        mocks.getSafeSdkSession.mockReturnValue(CURRENT_SDK);
        mocks.getTokenExpMs.mockReturnValue(null); // undecodable
        mocks.expiresWithinMs.mockReturnValue(false); // fails open
        mocks.getSafeSession.mockReturnValue({ token: "wallet-token" });
        mocks.generateGet.mockResolvedValue({ data: FRESH_SDK, error: null });

        const { ensureFreshSdkSession } = await import(
            "./ensureFreshSdkSession"
        );
        const result = await ensureFreshSdkSession();

        expect(result).toEqual({ status: "fresh", sdk: FRESH_SDK });
        expect(mocks.generateGet).toHaveBeenCalledTimes(1);
    });

    it("returns dead when no wallet session exists", async () => {
        mocks.getSafeSdkSession.mockReturnValue(CURRENT_SDK);
        mocks.expiresWithinMs.mockReturnValue(true); // near expiry → attempt renew
        mocks.getSafeSession.mockReturnValue(null); // no wallet

        const { ensureFreshSdkSession } = await import(
            "./ensureFreshSdkSession"
        );
        const result = await ensureFreshSdkSession();

        expect(result).toEqual({ status: "dead" });
        expect(mocks.generateGet).not.toHaveBeenCalled();
    });

    it("returns fresh with new sdk when /generate succeeds", async () => {
        mocks.getSafeSdkSession.mockReturnValue(null); // no current sdk
        mocks.expiresWithinMs.mockReturnValue(true);
        mocks.getSafeSession.mockReturnValue({ token: "wallet-token" });
        mocks.generateGet.mockResolvedValue({ data: FRESH_SDK, error: null });

        const { ensureFreshSdkSession } = await import(
            "./ensureFreshSdkSession"
        );
        const result = await ensureFreshSdkSession();

        expect(result).toEqual({ status: "fresh", sdk: FRESH_SDK });
        expect(mocks.generateGet).toHaveBeenCalledTimes(1);
    });

    it("returns dead when /generate returns 401 (server-confirmed dead wallet token)", async () => {
        mocks.getSafeSdkSession.mockReturnValue(CURRENT_SDK);
        mocks.expiresWithinMs.mockReturnValue(true);
        mocks.getSafeSession.mockReturnValue({ token: "wallet-token" });
        mocks.generateGet.mockResolvedValue({
            data: null,
            error: { status: 401 },
        });

        const { ensureFreshSdkSession } = await import(
            "./ensureFreshSdkSession"
        );
        const result = await ensureFreshSdkSession();

        expect(result).toEqual({ status: "dead" });
    });

    it("returns stale with current sdk on 5xx (transient error — do NOT logout)", async () => {
        mocks.getSafeSdkSession.mockReturnValue(CURRENT_SDK);
        mocks.expiresWithinMs.mockReturnValue(true);
        mocks.getSafeSession.mockReturnValue({ token: "wallet-token" });
        mocks.generateGet.mockResolvedValue({
            data: null,
            error: { status: 500 },
        });

        const { ensureFreshSdkSession } = await import(
            "./ensureFreshSdkSession"
        );
        const result = await ensureFreshSdkSession();

        expect(result).toEqual({ status: "stale", sdk: CURRENT_SDK });
    });

    it("returns stale on network error (Eden 503 TypeError — transient)", async () => {
        mocks.getSafeSdkSession.mockReturnValue(CURRENT_SDK);
        mocks.expiresWithinMs.mockReturnValue(true);
        mocks.getSafeSession.mockReturnValue({ token: "wallet-token" });
        mocks.generateGet.mockResolvedValue({
            data: null,
            error: { status: 503, value: new TypeError("Failed to fetch") },
        });

        const { ensureFreshSdkSession } = await import(
            "./ensureFreshSdkSession"
        );
        const result = await ensureFreshSdkSession();

        expect(result).toEqual({ status: "stale", sdk: CURRENT_SDK });
    });

    it("does NOT call setSdkSession when token is unchanged", async () => {
        mocks.getSafeSdkSession.mockReturnValue(CURRENT_SDK);
        mocks.expiresWithinMs.mockReturnValue(true);
        mocks.getSafeSession.mockReturnValue({ token: "wallet-token" });
        // generate returns the same token
        mocks.generateGet.mockResolvedValue({ data: CURRENT_SDK, error: null });
        mocks.sessionStoreGetState.mockReturnValue({
            sdkSession: CURRENT_SDK,
            setSdkSession: mocks.setSdkSession,
        });

        const { ensureFreshSdkSession } = await import(
            "./ensureFreshSdkSession"
        );
        await ensureFreshSdkSession();

        expect(mocks.setSdkSession).not.toHaveBeenCalled();
    });

    it("calls setSdkSession when token changes", async () => {
        mocks.getSafeSdkSession.mockReturnValue(CURRENT_SDK);
        mocks.expiresWithinMs.mockReturnValue(true);
        mocks.getSafeSession.mockReturnValue({ token: "wallet-token" });
        mocks.generateGet.mockResolvedValue({ data: FRESH_SDK, error: null });
        mocks.sessionStoreGetState.mockReturnValue({
            sdkSession: CURRENT_SDK,
            setSdkSession: mocks.setSdkSession,
        });

        const { ensureFreshSdkSession } = await import(
            "./ensureFreshSdkSession"
        );
        await ensureFreshSdkSession();

        expect(mocks.setSdkSession).toHaveBeenCalledWith(FRESH_SDK);
    });
});
