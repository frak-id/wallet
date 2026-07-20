import type { LoserAssetSummary } from "../../hook/useLoserAssetSummary";
import type { MergeStrategy } from "../../strategy/types";
import type { SettleRecoveryTarget } from "../SettlingStep";

export type Step =
    | { kind: "discovery" }
    | { kind: "preview" }
    | { kind: "consent" }
    | { kind: "sign"; consentSignature: string }
    | { kind: "migrate"; consentSignature: string }
    | { kind: "settling"; consentSignature: string }
    | { kind: "success" };

/**
 * Which signing step (if any) is routed through the paired mobile in
 * the current cross-device direction. Mirrors the transport matrix in
 * `useRemoteMergeStrategy`. Local merges and pre-preview state both
 * resolve to `null`.
 */
export function resolvePeerSigningStep(
    mode: MergeStrategy["mode"],
    needsSwitch: boolean | undefined
): "sign" | "migrate" | null {
    if (mode !== "remote" || needsSwitch === undefined) return null;
    return needsSwitch ? "sign" : "migrate";
}

/**
 * Migrate is skipped entirely when the loser has no funds (see
 * `nextStepAfterSign`). Mirror that here so the back button lands on the
 * screen the user actually came from.
 */
export function settlingBackStep(
    consentSignature: string,
    summary: LoserAssetSummary | null | undefined
): Step {
    if (summary?.hasFunds === false) return { kind: "sign", consentSignature };
    return { kind: "migrate", consentSignature };
}

export function settlingRecoveryStep(
    target: SettleRecoveryTarget,
    consentSignature: string
): Step {
    if (target === "sign" || target === "migrate")
        return { kind: target, consentSignature };
    return { kind: target };
}

/**
 * Decide which step to move to once the addPassKey has been signed.
 * Skip Migrate entirely when the loser has already been drained — without
 * this guard the user sees an empty "Move your funds" CTA for one frame
 * before AssetMigrationStep's auto-advance effect kicks in. The migrate
 * screen keeps the same defence for the case where the summary resolves
 * between here and its own mount.
 */
export function nextStepAfterSign(
    consentSignature: string,
    summary: LoserAssetSummary | null | undefined
): Step {
    if (summary && !summary.hasFunds)
        return { kind: "settling", consentSignature };
    return { kind: "migrate", consentSignature };
}
