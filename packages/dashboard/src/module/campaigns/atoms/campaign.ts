import {
    campaignIsClosingAtom,
    campaignStepAtom,
    campaignSuccessAtom,
} from "@/module/campaigns/atoms/steps";
import type { Campaign } from "@/types/Campaign";
import {
    type InteractionTypesKey,
    interactionTypes,
} from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * Get all the keys from the interaction types
 */
const flattenedKeys: InteractionTypesKey[] = Object.values(
    interactionTypes
).flatMap(Object.keys) as InteractionTypesKey[];

const initialValues: Campaign = {
    title: "",
    order: "",
    type: "",
    productId: "",
    specialCategories: [],
    budget: {
        type: "",
        maxEuroDaily: 0,
    },
    territories: [],
    scheduled: {
        dateStart: new Date(),
    },
    rewards: Object.fromEntries(
        flattenedKeys.map((key) => [key, { from: 0, to: 0 }])
    ) as Record<InteractionTypesKey, { from: number; to: number }>,
};

/**
 * Atom to save the current campaign
 */
export const campaignAtom = atomWithStorage<Campaign>(
    "campaign",
    initialValues
);

/**
 * Keep track to know if campaign has been fetched
 */
export const isFetchedCampaignAtom = atom(false);

/**
 * Atom to know if we create or edit a campaign
 */
export const campaignActionAtom = atom<"create" | "edit" | undefined>(
    undefined
);

/**
 * Atom to reset the recovery
 */
export const campaignResetAtom = atom(null, (_get, set) => {
    set(campaignAtom, initialValues);
    set(campaignSuccessAtom, false);
    set(campaignIsClosingAtom, false);
    set(campaignStepAtom, 1);
    set(isFetchedCampaignAtom, false);
    set(campaignActionAtom, undefined);
});
