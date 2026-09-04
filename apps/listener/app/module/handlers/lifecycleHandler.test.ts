import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports from the module under
// test so vi.mock hoisting works correctly.
// ---------------------------------------------------------------------------

const mockMergeExecutePost = vi.fn();
const mockTrackEvent = vi.fn();
const mockSetContext = vi.fn();
const mockSetTrustLevel = vi.fn();
const mockSetBackendConfig = vi.fn();

vi.mock("@frak-labs/wallet-shared/common/analytics", () => ({
    trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
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

    test("refuses when sdkIdentity carries no anonymousId", async () => {
        // Nothing identifies what the orphan proof covers, so there is no
        // target it can be paired with and the merge is refused outright.
        const data = baseData({
            pendingMergeToken: "the-merge-token",
            sdkIdentity: { proofs: { merge: "orphan-proof" } },
        });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockMergeExecutePost).not.toHaveBeenCalled();
    });

    test("refuses when sdkIdentity is absent", async () => {
        const data = baseData({ pendingMergeToken: "the-merge-token" });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockMergeExecutePost).not.toHaveBeenCalled();
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
        "refuses without throwing when sdkIdentity is malformed (%s)",
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

            expect(mockMergeExecutePost).not.toHaveBeenCalled();
        }
    );

    test("ignores an unknown proof key rather than treating it as the merge proof", async () => {
        const data = baseData({
            pendingMergeToken: "the-merge-token",
            sdkAnonymousId: "sdk-anon-id",
            sdkIdentity: {
                anonymousId: "sdk-anon-id",
                proofs: { mergeExecute: "not-a-key-we-read" },
            },
        });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockMergeExecutePost).not.toHaveBeenCalled();
    });

    test("stores sdkIdentity.proofs.mergeSource on the context for the mint path", async () => {
        const data = baseData({
            sdkIdentity: {
                anonymousId: "sdk-anon-id",
                proofs: { mergeSource: "the-source-proof" },
            },
        });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockSetContext).toHaveBeenCalledWith(
            expect.objectContaining({ mergeSourceProof: "the-source-proof" })
        );
    });

    test("a re-pushed config overwrites the stored mergeSource proof", async () => {
        for (const proof of ["stale-proof", "fresh-proof"]) {
            await clientLifecycleHandler(
                {
                    clientLifecycle: "resolved-config",
                    data: baseData({
                        sdkIdentity: {
                            anonymousId: "sdk-anon-id",
                            proofs: { mergeSource: proof },
                        },
                    }),
                },
                CONTEXT
            );
        }

        expect(mockSetContext).toHaveBeenLastCalledWith(
            expect.objectContaining({ mergeSourceProof: "fresh-proof" })
        );
    });

    test("a re-push carrying no mergeSource clears the stored one", async () => {
        await clientLifecycleHandler(
            {
                clientLifecycle: "resolved-config",
                data: baseData({
                    sdkIdentity: {
                        anonymousId: "sdk-anon-id",
                        proofs: { mergeSource: "stale-proof" },
                    },
                }),
            },
            CONTEXT
        );
        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data: baseData() },
            CONTEXT
        );

        expect(mockSetContext.mock.calls.at(-1)?.[0]).not.toHaveProperty(
            "mergeSourceProof"
        );
    });

    test("does not set mergeSourceProof when the SDK sent none", async () => {
        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data: baseData() },
            CONTEXT
        );

        expect(mockSetContext.mock.calls[0][0]).not.toHaveProperty(
            "mergeSourceProof"
        );
    });

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
    test("counts a proven target carrying its execute proof as proven", async () => {
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

        expect(mockTrackEvent).toHaveBeenCalledWith(
            "merge_execute_target_source",
            { source: "proven" }
        );
    });

    test("counts and refuses a proven target with no execute proof", async () => {
        const data = baseData({
            pendingMergeToken: "the-merge-token",
            sdkAnonymousId: "sdk-anon-id",
            sdkIdentity: { anonymousId: "sdk-anon-id", proofs: {} },
        });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockTrackEvent).toHaveBeenCalledWith(
            "merge_execute_target_source",
            { source: "proven_unproven" }
        );
        expect(mockMergeExecutePost).not.toHaveBeenCalled();
        expect(mockTrackEvent).toHaveBeenCalledWith("identity_ensure_failed", {
            source: "inapp_redirect",
            error_type: "no_merge_target",
        });
    });

    test("counts and refuses the unproven fallback", async () => {
        const data = baseData({ pendingMergeToken: "the-merge-token" });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockTrackEvent).toHaveBeenCalledWith(
            "merge_execute_target_source",
            { source: "fallback" }
        );
        expect(mockMergeExecutePost).not.toHaveBeenCalled();
    });

    test("pairs every refusal with an executed event", async () => {
        const data = baseData({ pendingMergeToken: "the-merge-token" });

        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data },
            CONTEXT
        );

        expect(mockTrackEvent).toHaveBeenCalledWith(
            "identity_ensure_executed",
            {
                source: "inapp_redirect",
            }
        );
        expect(mockTrackEvent).toHaveBeenCalledWith("identity_ensure_failed", {
            source: "inapp_redirect",
            error_type: "no_merge_target",
        });
    });
});

describe("clientLifecycleHandler — merge redemption retry", () => {
    function provenData() {
        return baseData({
            pendingMergeToken: "the-merge-token",
            sdkAnonymousId: "sdk-anon-id",
            sdkIdentity: {
                anonymousId: "sdk-anon-id",
                proofs: { merge: "the-merge-proof" },
            },
        });
    }

    async function redeem() {
        await clientLifecycleHandler(
            { clientLifecycle: "resolved-config", data: provenData() },
            CONTEXT
        );
        await vi.advanceTimersByTimeAsync(10_000);
    }

    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    test("retries a 5xx and reports the success that follows it", async () => {
        mockMergeExecutePost
            .mockResolvedValueOnce({ error: { status: 503 } })
            .mockResolvedValueOnce({ error: undefined });

        await redeem();

        expect(mockMergeExecutePost).toHaveBeenCalledTimes(2);
        expect(mockTrackEvent).toHaveBeenCalledWith(
            "identity_ensure_succeeded",
            expect.objectContaining({ source: "inapp_redirect" })
        );
    });

    test("retries a thrown network failure", async () => {
        mockMergeExecutePost
            .mockRejectedValueOnce(new Error("NetworkError"))
            .mockResolvedValueOnce({ error: undefined });

        await redeem();

        expect(mockMergeExecutePost).toHaveBeenCalledTimes(2);
    });

    test("never retries a 4xx, so a refusal stays one request", async () => {
        mockMergeExecutePost.mockResolvedValue({
            error: { status: 403, value: { code: "PROOF_REQUIRED" } },
        });

        await redeem();

        expect(mockMergeExecutePost).toHaveBeenCalledTimes(1);
        expect(mockTrackEvent).toHaveBeenCalledWith("identity_ensure_failed", {
            source: "inapp_redirect",
            error_type: "PROOF_REQUIRED",
        });
    });

    test("gives up after the bounded retries rather than looping", async () => {
        mockMergeExecutePost.mockResolvedValue({ error: { status: 500 } });

        await redeem();

        expect(mockMergeExecutePost).toHaveBeenCalledTimes(3);
        expect(mockTrackEvent).toHaveBeenCalledWith("identity_ensure_failed", {
            source: "inapp_redirect",
            error_type: "unknown",
        });
    });
});
