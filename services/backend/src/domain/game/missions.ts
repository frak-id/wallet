import type { AssetLogRecipientType } from "../rewards/schemas";

/** `brand_reward`: a live reward from a partner brand, as buyer or referrer. `instagram_follow`: the subject follows @frak_fr. */
export type Mission = { kind: "brand_reward" } | { kind: "instagram_follow" };

export type MissionSet = {
    match: "all" | "any";
    missions: readonly Mission[];
};

/** Whose missions count: the reward's recipient, or the friend they referred. */
export type MissionSubject = "recipient" | "referee";

/** What every held game reward waits on until missions are set per rule. */
export const DEFAULT_MISSIONS: MissionSet = {
    match: "any",
    missions: [{ kind: "brand_reward" }, { kind: "instagram_follow" }],
};

/** Roles whose held reward waits on the referee's missions. */
export const REFEREE_WAITING_ROLES = [
    "referrer",
] as const satisfies readonly AssetLogRecipientType[];

export function missionSubjectOf(role: AssetLogRecipientType): MissionSubject {
    return (REFEREE_WAITING_ROLES as readonly string[]).includes(role)
        ? "referee"
        : "recipient";
}

/** A released reward stays payable at least this long after its lockup ends. */
export const RELEASE_GRACE_MS = 7 * 24 * 60 * 60 * 1000;
