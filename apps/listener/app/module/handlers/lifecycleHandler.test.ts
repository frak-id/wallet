import { beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports from the module under
// test so vi.mock hoisting works correctly.
// ---------------------------------------------------------------------------

const mockMergeExecutePost = vi.fn();
const mockSetContext = vi.fn();
const mockSetTrustLevel = vi.fn();
const mockSetBackendConfig = vi.fn();

vi.mock("@frak-labs/wallet-shared/common/analytics", () => ({
    trackEvent: vi.fn(),
    updateGlobalProperties: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/common/api/backendClient", () => ({
    authenticatedBackendApi: {
        user: {
            identity: {
                merge: {
                    execute: {
                        post: (...args: unknown[]) =>
                            mockMergeExecutePost(...args),
                    },
                },
            },
        },
    },
}));

vi.mock("@frak-labs/wallet-shared/common/utils/lifecycleEvents", () => ({
    emitLifecycleEvent: vi.fn(),
}));

vi.mock("@frak-labs/wallet-shared/stores/clientIdStore", () => ({
    clientIdStore: {
        getState: () => ({ clientId: "store-client-id" }),
    },
}));

vi.mock("@/i18nOverrideQueue", () => ({
    enqueueI18nOverride: vi.fn(),
    enqueueLanguageChange: vi.fn(),
}));

vi.mock("@/module/utils/backup", () => ({
    restoreBackupData: vi.fn(),
}));

vi.mock("./ssoHandler", () => ({
    processSsoCompletion: vi.fn(),
}));

vi.mock("@/module/stores/resolvingContextStore", () => ({
    iframeClientId: "iframe-client-id",
    resolvingContextStore: {
        getState: () => ({
            setContext: mockSetContext,
            setTrustLevel: mockSetTrustLevel,
            setBackendConfig: mockSetBackendConfig,
            trustLevel: "verified",
        }),
    },
}));

import { clientLifecycleHandler } from "./lifecycleHandler";

const CONTEXT = {
    origin: "https://example.com",
    source: null,
} as Parameters<typeof clientLifecycleHandler>[1];

function baseData(overrides: Record<string, unknown> = {}) {
    return {
        merchantId: "merchant-1",
        domain: "example.com",
        allowedDomains: ["example.com"],
        sourceUrl: "https://example.com/page",
        ...overrides,
    };
}

describe("clientLifecycleHandler — resolved-config", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockMergeExecutePost.mockResolvedValue({ error: undefined });
    });

    test("forwards sdkIdentity.proofs.merge, targeting the id the proof covers", async () => {
        const data = baseData({
            pendingMergeToken: "the-merge-token",
            sdkAnonymousId: "sdk-anon-id",
            sdkIdentity: {
                anonymousId: "sdk-anon-id",
                proofs: { merge: "the-merge-proof" },
            },
        });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockMergeExecutePost).toHaveBeenCalledWith({
            mergeToken: "the-merge-token",
            targetAnonymousId: "sdk-anon-id",
            merchantId: "merchant-1",
            proof: "the-merge-proof",
        });
    });

    test("targets the id inside sdkIdentity, not the sibling sdkAnonymousId field", async () => {
        // `sdkAnonymousId` and `sdkIdentity.anonymousId` are separate keys on
        // the same untrusted payload. Only the latter is what the proof was
        // signed over, so a tampered message setting them to different values
        // must not get a valid proof attached to the attacker's chosen target.
        const data = baseData({
            pendingMergeToken: "the-merge-token",
            sdkAnonymousId: "victim-anon-id",
            sdkIdentity: {
                anonymousId: "attacker-own-anon-id",
                proofs: { merge: "proof-over-attacker-id" },
            },
        });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockMergeExecutePost).toHaveBeenCalledWith({
            mergeToken: "the-merge-token",
            targetAnonymousId: "attacker-own-anon-id",
            merchantId: "merchant-1",
            proof: "proof-over-attacker-id",
        });
    });

    test("falls back to the local id, unproven, when sdkIdentity carries no anonymousId", async () => {
        // Nothing identifies what the proof covers, so the merge goes out
        // unproven rather than pairing a proof with an unverifiable target.
        const data = baseData({
            pendingMergeToken: "the-merge-token",
            sdkIdentity: { proofs: { merge: "orphan-proof" } },
        });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockMergeExecutePost).toHaveBeenCalledWith({
            mergeToken: "the-merge-token",
            targetAnonymousId: "iframe-client-id",
            merchantId: "merchant-1",
            proof: undefined,
        });
    });

    test("sends proof: undefined (byte-identical to omission) when sdkIdentity is absent", async () => {
        const data = baseData({ pendingMergeToken: "the-merge-token" });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        const body = mockMergeExecutePost.mock.calls[0][0];
        expect(body).toEqual({
            mergeToken: "the-merge-token",
            targetAnonymousId: "iframe-client-id",
            merchantId: "merchant-1",
            proof: undefined,
        });
        expect(JSON.stringify(body)).toBe(
            JSON.stringify({
                mergeToken: "the-merge-token",
                targetAnonymousId: "iframe-client-id",
                merchantId: "merchant-1",
            })
        );
    });

    test.each([
        ["a plain string", "not-an-object"],
        ["a number", 42],
        ["proofs missing", { anonymousId: "a1" }],
        ["proofs not an object", { anonymousId: "a1", proofs: "nope" }],
        [
            "proofs.merge not a string",
            { anonymousId: "a1", proofs: { merge: 123 } },
        ],
        ["null", null],
    ])(
        "degrades to no proof without throwing when sdkIdentity is malformed (%s)",
        async (_label, sdkIdentity) => {
            const data = baseData({
                pendingMergeToken: "the-merge-token",
                sdkIdentity,
            });

            await expect(
                clientLifecycleHandler(
                    { clientLifecycle: "resolved-config", data },
                    CONTEXT
                )
            ).resolves.toBeUndefined();

            const body = mockMergeExecutePost.mock.calls[0][0];
            expect(body.proof).toBeUndefined();
        }
    );

    test("stores sdkIdentity.proofs.install on the context for the install URL", async () => {
        const data = baseData({
            sdkIdentity: {
                anonymousId: "sdk-anon-id",
                proofs: { install: "the-install-proof" },
            },
        });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockSetContext).toHaveBeenCalledWith(
            expect.objectContaining({ installProof: "the-install-proof" })
        );
    });

    test("does not set installProof when sdkIdentity.proofs.install is absent", async () => {
        const data = baseData();

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        const setContextArg = mockSetContext.mock.calls[0][0];
        expect(setContextArg).not.toHaveProperty("installProof");
    });
});
