import {
    buildProofMessage,
    deriveClientIdFromHash,
} from "@frak-labs/core-sdk/identity";
import goldenProofs from "@frak-labs/core-sdk/identity/fixtures";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@frak-labs/app-essentials", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    isRunningLocally: false,
}));

const getMerchantRewardSummary = vi.hoisted(() => vi.fn());

vi.mock("../../../orchestration/context", () => ({
    OrchestrationContext: {
        orchestrators: { rewardHistory: { getMerchantRewardSummary } },
    },
}));

import { infraMetrics } from "../../../infrastructure/telemetry";
import { userMerchantApi } from "./index";

const installFixture = goldenProofs.fixtures.find(
    ({ op }) => op === "frak-install-v1"
);
const ensureFixture = goldenProofs.fixtures.find(
    ({ op }) => op === "frak-ensure-v1"
);
if (!installFixture || !ensureFixture) throw new Error("fixtures missing");

const EMPTY = { linked: false, pending: null, earned: null };

const OTHER_MERCHANT_ID = "7d2f6a10-3c5b-4e8a-9b1d-0a4c8e6f2b13";

function toBase64Url(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString("base64url");
}

async function signRewardsProof(params: { merchantId: string; ts: number }) {
    const keys = await crypto.subtle.generateKey(
        { name: "ECDSA", namedCurve: "P-256" },
        true,
        ["sign"]
    );
    const pk = new Uint8Array(
        await crypto.subtle.exportKey("raw", keys.publicKey)
    );
    const anonymousId = deriveClientIdFromHash(
        new Uint8Array(await crypto.subtle.digest("SHA-256", pk))
    );
    const message = buildProofMessage({
        op: "frak-rewards-v1",
        merchantId: params.merchantId,
        anonymousId,
        binding: new Uint8Array(0),
        ts: params.ts,
    });
    const sig = new Uint8Array(
        await crypto.subtle.sign(
            { name: "ECDSA", hash: "SHA-256" },
            keys.privateKey,
            message
        )
    );
    const envelope = new Uint8Array(1 + 65 + 8 + 64);
    envelope[0] = 1;
    envelope.set(pk, 1);
    new DataView(envelope.buffer).setBigUint64(66, BigInt(params.ts));
    envelope.set(sig, 74);
    return { anonymousId, proof: toBase64Url(envelope) };
}

function getSummary(headers: Record<string, string>) {
    return userMerchantApi.handle(
        new Request(
            `http://localhost/merchant/rewards-summary?merchantId=${installFixture?.merchantId}`,
            { headers }
        )
    );
}

describe("GET /merchant/rewards-summary", () => {
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(installFixture.ts * 1000);
        getMerchantRewardSummary.mockReset().mockResolvedValue(EMPTY);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("answers 400 without a client id", async () => {
        const res = await getSummary({ "x-frak-proof": installFixture.proof });

        expect(res.status).toBe(400);
        expect(getMerchantRewardSummary).not.toHaveBeenCalled();
    });

    it("answers 403 PROOF_REQUIRED for a bare client id", async () => {
        const res = await getSummary({
            "x-frak-client-id": installFixture.anonymousId,
        });

        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code: "PROOF_REQUIRED" });
        expect(getMerchantRewardSummary).not.toHaveBeenCalled();
    });

    it("answers 403 PROOF_INVALID for a proof signed for another op", async () => {
        const res = await getSummary({
            "x-frak-client-id": ensureFixture.anonymousId,
            "x-frak-proof": ensureFixture.proof,
        });

        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code: "PROOF_INVALID" });
        expect(getMerchantRewardSummary).not.toHaveBeenCalled();
    });

    it("accepts an install-v1 proof and forbids caching", async () => {
        const summary = {
            linked: false,
            pending: {
                total: { eurAmount: 5, usdAmount: 6, gbpAmount: 4 },
                cashback: { eurAmount: 5, usdAmount: 6, gbpAmount: 4 },
                fromFriends: { eurAmount: 0, usdAmount: 0, gbpAmount: 0 },
                count: 1,
                lockedCount: 0,
                nextUnlockAt: null,
                expiresAt: null,
            },
            earned: null,
        };
        getMerchantRewardSummary.mockResolvedValue(summary);

        const res = await getSummary({
            "x-frak-client-id": installFixture.anonymousId,
            "x-frak-proof": installFixture.proof,
        });

        expect(res.status).toBe(200);
        expect(res.headers.get("cache-control")).toBe("private, no-store");
        expect(await res.json()).toEqual(summary);
        expect(getMerchantRewardSummary).toHaveBeenCalledWith({
            anonymousId: installFixture.anonymousId,
            merchantId: installFixture.merchantId,
        });
    });

    it("accepts a frak-rewards-v1 proof", async () => {
        const now = installFixture.ts;
        const { anonymousId, proof } = await signRewardsProof({
            merchantId: installFixture.merchantId,
            ts: now,
        });

        const res = await getSummary({
            "x-frak-client-id": anonymousId,
            "x-frak-proof": proof,
        });

        expect(res.status).toBe(200);
        expect(getMerchantRewardSummary).toHaveBeenCalledWith({
            anonymousId,
            merchantId: installFixture.merchantId,
        });
    });

    it("answers 403 for a rewards-v1 proof signed for another merchant", async () => {
        const { anonymousId, proof } = await signRewardsProof({
            merchantId: OTHER_MERCHANT_ID,
            ts: installFixture.ts,
        });

        const res = await getSummary({
            "x-frak-client-id": anonymousId,
            "x-frak-proof": proof,
        });

        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code: "PROOF_INVALID" });
        expect(getMerchantRewardSummary).not.toHaveBeenCalled();
    });

    it("answers 403 for a rewards-v1 proof older than 10 minutes", async () => {
        const { anonymousId, proof } = await signRewardsProof({
            merchantId: installFixture.merchantId,
            ts: installFixture.ts - 10 * 60 - 1,
        });

        const res = await getSummary({
            "x-frak-client-id": anonymousId,
            "x-frak-proof": proof,
        });

        expect(res.status).toBe(403);
        expect(await res.json()).toMatchObject({ code: "PROOF_INVALID" });
    });

    it("records one valid outcome for the op that matched", async () => {
        const record = vi.spyOn(infraMetrics, "identityProofChecked");

        await getSummary({
            "x-frak-client-id": installFixture.anonymousId,
            "x-frak-proof": installFixture.proof,
        });

        expect(record.mock.calls).toEqual([["frak-install-v1", "valid"]]);
        record.mockRestore();
    });

    it("records one invalid outcome for a rejected proof", async () => {
        const record = vi.spyOn(infraMetrics, "identityProofChecked");

        await getSummary({
            "x-frak-client-id": ensureFixture.anonymousId,
            "x-frak-proof": ensureFixture.proof,
        });

        expect(record).toHaveBeenCalledTimes(1);
        expect(record.mock.calls[0]?.[1]).toBe("invalid");
        record.mockRestore();
    });

    it("answers an empty summary for an unknown id holding a valid proof", async () => {
        const res = await getSummary({
            "x-frak-client-id": installFixture.anonymousId,
            "x-frak-proof": installFixture.proof,
        });

        expect(await res.json()).toEqual(EMPTY);
    });
});
