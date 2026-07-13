import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveBusinessAuth } from "./resolveBusinessAuth";

const resolve = vi.fn();
const findById = vi.fn();

vi.mock("../../../domain/business-auth", () => ({
    BusinessAuthContext: {
        services: { session: { resolve: (t: string) => resolve(t) } },
        repositories: { account: { findById: (id: string) => findById(id) } },
    },
}));

// A dot-free token so `resolveBusinessAuth` takes the DB-session path (not the
// legacy JWT branch, which is keyed off a `.` in the token).
const TOKEN = "opaque-session-token";

function sessionRow(overrides: Record<string, unknown>) {
    return {
        id: "session-1",
        accountId: "account-1",
        authMethod: "password",
        twoFactorVerifiedAt: null,
        ...overrides,
    };
}

describe("resolveBusinessAuth — pending2fa", () => {
    beforeEach(() => {
        resolve.mockReset();
        findById.mockReset();
        findById.mockResolvedValue({ walletAddress: null });
    });

    it("keeps a password session pending until 2FA is verified", async () => {
        resolve.mockResolvedValue(
            sessionRow({ authMethod: "password", twoFactorVerifiedAt: null })
        );

        const auth = await resolveBusinessAuth(TOKEN);

        expect(auth?.pending2fa).toBe(true);
    });

    it("clears pending once a password session has verified 2FA", async () => {
        resolve.mockResolvedValue(
            sessionRow({
                authMethod: "password",
                twoFactorVerifiedAt: new Date(),
            })
        );

        const auth = await resolveBusinessAuth(TOKEN);

        expect(auth?.pending2fa).toBe(false);
    });

    it("treats a Shopify SSO session as usable immediately (OAuth is the login factor)", async () => {
        resolve.mockResolvedValue(
            sessionRow({ authMethod: "shopify", twoFactorVerifiedAt: null })
        );

        const auth = await resolveBusinessAuth(TOKEN);

        // Usable (not pending) but deliberately NOT step-up-fresh: the null
        // `twoFactorVerifiedAt` still forces a real step-up for sensitive
        // actions.
        expect(auth?.pending2fa).toBe(false);
        expect(auth?.twoFactorVerifiedAt).toBeNull();
    });
});
