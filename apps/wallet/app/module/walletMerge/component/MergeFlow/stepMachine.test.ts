import type { Address } from "viem";
import { describe, expect, test } from "vitest";
import type { LoserAssetSummary } from "../../hook/useLoserAssetSummary";
import {
    nextStepAfterSign,
    resolvePeerSigningStep,
    settlingBackStep,
    settlingRecoveryStep,
} from "./stepMachine";

const LOSER = "0x1111111111111111111111111111111111111111" as Address;
const SIG = "0xsignature";

function summary(hasFunds: boolean): LoserAssetSummary {
    return { loser: LOSER, entries: [], hasFunds };
}

describe("resolvePeerSigningStep", () => {
    test("routes the paired-mobile signing step per mode × needsSwitch", () => {
        expect(resolvePeerSigningStep("remote", true)).toBe("sign");
        expect(resolvePeerSigningStep("remote", false)).toBe("migrate");
    });

    test("returns null when no peer signing is routed", () => {
        expect(resolvePeerSigningStep("remote", undefined)).toBeNull();
        expect(resolvePeerSigningStep("local", true)).toBeNull();
        expect(resolvePeerSigningStep("local", false)).toBeNull();
        expect(resolvePeerSigningStep("local", undefined)).toBeNull();
    });
});

describe("nextStepAfterSign", () => {
    test("moves to migrate when the loser has funds", () => {
        expect(nextStepAfterSign(SIG, summary(true))).toEqual({
            kind: "migrate",
            consentSignature: SIG,
        });
    });

    test("skips migrate to settling when the loser has no funds", () => {
        expect(nextStepAfterSign(SIG, summary(false))).toEqual({
            kind: "settling",
            consentSignature: SIG,
        });
    });

    test("defaults to migrate while the summary is still unresolved", () => {
        expect(nextStepAfterSign(SIG, undefined)).toEqual({
            kind: "migrate",
            consentSignature: SIG,
        });
        expect(nextStepAfterSign(SIG, null)).toEqual({
            kind: "migrate",
            consentSignature: SIG,
        });
    });
});

describe("settlingBackStep", () => {
    test("lands on sign when the loser had no funds (migrate was skipped)", () => {
        expect(settlingBackStep(SIG, summary(false))).toEqual({
            kind: "sign",
            consentSignature: SIG,
        });
    });

    test("lands on migrate when the loser had funds", () => {
        expect(settlingBackStep(SIG, summary(true))).toEqual({
            kind: "migrate",
            consentSignature: SIG,
        });
    });

    test("defaults to migrate while the summary is still unresolved", () => {
        expect(settlingBackStep(SIG, undefined)).toEqual({
            kind: "migrate",
            consentSignature: SIG,
        });
    });
});

describe("settlingRecoveryStep", () => {
    test("carries the consent signature for sign/migrate targets", () => {
        expect(settlingRecoveryStep("sign", SIG)).toEqual({
            kind: "sign",
            consentSignature: SIG,
        });
        expect(settlingRecoveryStep("migrate", SIG)).toEqual({
            kind: "migrate",
            consentSignature: SIG,
        });
    });

    test("omits the signature for signature-less targets", () => {
        expect(settlingRecoveryStep("preview", SIG)).toEqual({
            kind: "preview",
        });
        expect(settlingRecoveryStep("consent", SIG)).toEqual({
            kind: "consent",
        });
    });
});
