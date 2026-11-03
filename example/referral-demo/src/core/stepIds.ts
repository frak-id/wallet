/** Every screen of the demo, in playback order. */
export const STEP_IDS = [
    "home",
    "referrer.intro",
    "referrer.storeHome",
    "referrer.product",
    "referrer.cart",
    "referrer.checkout",
    "referrer.thankYou",
    "referrer.sharing",
    "referrer.shareSheet",
    "referrer.storyComposer",
    "referrer.thankYouShared",
    "referrer.install",
    "referrer.onboarding",
    "referrer.passkey",
    "referrer.wallet",
    "referee.intro",
    "referee.feed",
    "referee.story",
    "referee.landing",
    "referee.checkout",
    "referee.thankYou",
    "referee.claim",
    "referee.wallet",
    "finale",
] as const;

export type StepId = (typeof STEP_IDS)[number];

export type ScenarioId = "referrer" | "referee";

export function isStepId(value: unknown): value is StepId {
    return (
        typeof value === "string" &&
        (STEP_IDS as readonly string[]).includes(value)
    );
}

export function stepIndex(id: StepId): number {
    return STEP_IDS.indexOf(id);
}

export function scenarioOf(id: StepId): ScenarioId | null {
    if (id.startsWith("referrer.")) return "referrer";
    if (id.startsWith("referee.")) return "referee";
    return null;
}
