/**
 * Single source of truth for the campaign creation wizard: ordered step keys,
 * their routes, and i18n key builders. Navigation helpers derive previous/next
 * from a step's index so the wizard chrome stays declarative.
 */

export type WizardStepKey =
    | "basics"
    | "goals"
    | "territory"
    | "budget"
    | "products"
    | "reward"
    | "referralChain"
    | "validation";

export type WizardStepDef = {
    key: WizardStepKey;
    /**
     * TanStack `to` template (params `$merchantId` / `$campaignId` filled at
     * navigation time). `basics` points at the editable campaign route.
     */
    to: string;
};

export const WIZARD_STEPS: WizardStepDef[] = [
    { key: "basics", to: "/m/$merchantId/campaigns/draft/$campaignId" },
    { key: "goals", to: "/m/$merchantId/campaigns/draft/$campaignId/goals" },
    {
        key: "territory",
        to: "/m/$merchantId/campaigns/draft/$campaignId/territory",
    },
    { key: "budget", to: "/m/$merchantId/campaigns/draft/$campaignId/budget" },
    {
        key: "products",
        to: "/m/$merchantId/campaigns/draft/$campaignId/products",
    },
    { key: "reward", to: "/m/$merchantId/campaigns/draft/$campaignId/reward" },
    {
        key: "referralChain",
        to: "/m/$merchantId/campaigns/draft/$campaignId/referral-chain",
    },
    {
        key: "validation",
        to: "/m/$merchantId/campaigns/draft/$campaignId/validation",
    },
];

/**
 * The steps a campaign actually walks through. Product scoping is a
 * purchase-only concept (the backend rejects `productScope` on any other
 * trigger), so a traffic/registration campaign skips it entirely.
 */
export function wizardStepsFor(includeProducts: boolean): WizardStepDef[] {
    return includeProducts
        ? WIZARD_STEPS
        : WIZARD_STEPS.filter((s) => s.key !== "products");
}

export function stepIndexOf(
    key: WizardStepKey,
    steps: WizardStepDef[] = WIZARD_STEPS
): number {
    return steps.findIndex((s) => s.key === key);
}

export function previousStep(
    index: number,
    steps: WizardStepDef[] = WIZARD_STEPS
): WizardStepDef | undefined {
    return index > 0 ? steps[index - 1] : undefined;
}

export function isLastStep(
    index: number,
    steps: WizardStepDef[] = WIZARD_STEPS
): boolean {
    return index === steps.length - 1;
}

/**
 * i18n keys under `campaigns.create.steps.<key>.*`. Declared as literals
 * (`as const`) so the typed `t()` accepts them.
 * - `label` = rail step title · `hint` = rail description · `subtitle` = page header subtitle.
 */
const STEP_I18N = {
    basics: {
        label: "campaigns.create.steps.basics.label",
        hint: "campaigns.create.steps.basics.hint",
        subtitle: "campaigns.create.steps.basics.subtitle",
    },
    goals: {
        label: "campaigns.create.steps.goals.label",
        hint: "campaigns.create.steps.goals.hint",
        subtitle: "campaigns.create.steps.goals.subtitle",
    },
    territory: {
        label: "campaigns.create.steps.territory.label",
        hint: "campaigns.create.steps.territory.hint",
        subtitle: "campaigns.create.steps.territory.subtitle",
    },
    budget: {
        label: "campaigns.create.steps.budget.label",
        hint: "campaigns.create.steps.budget.hint",
        subtitle: "campaigns.create.steps.budget.subtitle",
    },
    products: {
        label: "campaigns.create.steps.products.label",
        hint: "campaigns.create.steps.products.hint",
        subtitle: "campaigns.create.steps.products.subtitle",
    },
    reward: {
        label: "campaigns.create.steps.reward.label",
        hint: "campaigns.create.steps.reward.hint",
        subtitle: "campaigns.create.steps.reward.subtitle",
    },
    referralChain: {
        label: "campaigns.create.steps.referralChain.label",
        hint: "campaigns.create.steps.referralChain.hint",
        subtitle: "campaigns.create.steps.referralChain.subtitle",
    },
    validation: {
        label: "campaigns.create.steps.validation.label",
        hint: "campaigns.create.steps.validation.hint",
        subtitle: "campaigns.create.steps.validation.subtitle",
    },
} as const satisfies Record<
    WizardStepKey,
    { label: string; hint: string; subtitle: string }
>;

export function stepI18n(key: WizardStepKey) {
    return STEP_I18N[key];
}
