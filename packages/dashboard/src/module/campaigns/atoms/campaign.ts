import {
    campaignIsClosingAtom,
    campaignStepAtom,
    campaignSuccessAtom,
} from "@/module/campaigns/atoms/steps";
import type { Campaign } from "@/types/Campaign";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

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
    rewards: {
        click: { from: 0, to: 0 },
        registration: { from: 0, to: 0 },
        purchase: { from: 0, to: 0 },
    },
    promotedContents: [],
};

/**
 * Atom to save the current campaign
 */
export const campaignAtom = atomWithStorage<Campaign>(
    "campaign",
    initialValues
);

/**
 * Atom to reset the recovery
 */
export const campaignResetAtom = atom(null, (_get, set) => {
    set(campaignAtom, initialValues);
    set(campaignSuccessAtom, false);
    set(campaignIsClosingAtom, false);
    set(campaignStepAtom, 1);
});
