import { HttpError } from "@backend-utils";
import { describe, expect, it, vi } from "vitest";
import type { IdentityRepository } from "../../domain/identity/repositories/IdentityRepository";
import type { IdentityProofService } from "../../domain/identity/services/IdentityProofService";
import { enforceLatchedProof, verifyProofUnenforced } from "./latchedProof";

/**
 * `onClass` is the only signal for three of the four credential classes:
 * `enforceLatchedProof` throws on `invalid` and `absent_latched`, so a call
 * site cannot tell those apart from the boolean it returns.
 */

const MERCHANT_ID = "merchant-1";
const ANONYMOUS_ID = "anon-1";

function makeDeps(options: {
    verifyOrThrowRejects?: boolean;
    proofSeenAt?: Date | null;
    verifyValid?: boolean;
}) {
    const identityProofService = {
        verifyOrThrow: vi.fn(async () => {
            if (options.verifyOrThrowRejects) {
                throw HttpError.forbidden("PROOF_INVALID", "nope");
            }
        }),
        verify: vi.fn(async () => ({
            valid: options.verifyValid ?? true,
            reason: options.verifyValid === false ? "bad_signature" : undefined,
        })),
    } as unknown as IdentityProofService;

    const identityRepository = {
        findNodeByIdentity: vi.fn(async () =>
            options.proofSeenAt === undefined
                ? null
                : { proofSeenAt: options.proofSeenAt }
        ),
    } as unknown as IdentityRepository;

    return { identityProofService, identityRepository };
}

function baseParams(deps: ReturnType<typeof makeDeps>, proof?: string) {
    return {
        op: "frak-merge-v1" as const,
        anonymousId: ANONYMOUS_ID,
        merchantId: MERCHANT_ID,
        proof,
        binding: new Uint8Array(0),
        context: "test",
        ...deps,
    };
}

describe("enforceLatchedProof — onClass emission", () => {
    it("emits `proven` exactly once for a valid proof", async () => {
        const onClass = vi.fn();
        const deps = makeDeps({});

        await expect(
            enforceLatchedProof({ ...baseParams(deps, "a-proof"), onClass })
        ).resolves.toBe(true);

        expect(onClass.mock.calls).toEqual([["proven"]]);
    });

    it("emits `invalid` exactly once before rethrowing a failed verification", async () => {
        const onClass = vi.fn();
        const deps = makeDeps({ verifyOrThrowRejects: true });

        await expect(
            enforceLatchedProof({ ...baseParams(deps, "a-proof"), onClass })
        ).rejects.toMatchObject({ code: "PROOF_INVALID" });

        expect(onClass.mock.calls).toEqual([["invalid"]]);
    });

    it("emits `absent_latched` exactly once before throwing PROOF_REQUIRED", async () => {
        const onClass = vi.fn();
        const deps = makeDeps({ proofSeenAt: new Date() });

        await expect(
            enforceLatchedProof({ ...baseParams(deps), onClass })
        ).rejects.toMatchObject({ code: "PROOF_REQUIRED" });

        expect(onClass.mock.calls).toEqual([["absent_latched"]]);
    });

    it("emits `absent_unlatched` exactly once on the fail-open path", async () => {
        const onClass = vi.fn();
        const deps = makeDeps({ proofSeenAt: null });

        await expect(
            enforceLatchedProof({ ...baseParams(deps), onClass })
        ).resolves.toBe(false);

        expect(onClass.mock.calls).toEqual([["absent_unlatched"]]);
    });

    it("emits `absent_unlatched` when the node does not exist at all", async () => {
        const onClass = vi.fn();
        const deps = makeDeps({});

        await expect(
            enforceLatchedProof({ ...baseParams(deps), onClass })
        ).resolves.toBe(false);

        expect(onClass.mock.calls).toEqual([["absent_unlatched"]]);
    });
});

describe("verifyProofUnenforced — onClass emission", () => {
    it("emits `proven` exactly once for a valid proof", async () => {
        const onClass = vi.fn();
        const { identityProofService } = makeDeps({ verifyValid: true });

        await expect(
            verifyProofUnenforced({
                op: "frak-install-v1",
                anonymousId: ANONYMOUS_ID,
                merchantId: MERCHANT_ID,
                proof: "a-proof",
                identityProofService,
                onClass,
            })
        ).resolves.toBe(true);

        expect(onClass.mock.calls).toEqual([["proven"]]);
    });

    it("emits `invalid` exactly once without throwing", async () => {
        const onClass = vi.fn();
        const { identityProofService } = makeDeps({ verifyValid: false });

        await expect(
            verifyProofUnenforced({
                op: "frak-install-v1",
                anonymousId: ANONYMOUS_ID,
                merchantId: MERCHANT_ID,
                proof: "a-proof",
                identityProofService,
                onClass,
            })
        ).resolves.toBe(false);

        expect(onClass.mock.calls).toEqual([["invalid"]]);
    });
});
