import {
    type InteractionTypesKey,
    interactionTypes,
} from "@frak-labs/core-sdk";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Campaign } from "@/types/Campaign";

/**
 * Get all the keys from the interaction types
 */
const flattenedKeys: InteractionTypesKey[] = Object.values(
    interactionTypes
).flatMap(Object.keys) as InteractionTypesKey[];

const initialValues: Campaign = {
    title: "",
    type: "",
    productId: "",
    specialCategories: [],
    budget: {
        type: "global",
        maxEuroDaily: 0,
    },
    territories: [],
    bank: "",
    scheduled: {
        dateStart: new Date(),
    },
    distribution: {
        type: "fixed",
    },
    rewardChaining: {
        userPercent: 0.1,
    },
    triggers: Object.fromEntries(
        flattenedKeys.map((key) => [key, { cac: 0 }])
    ) as Record<InteractionTypesKey, { cac: number }>,
};

type CampaignState = {
    // State
    campaign: Campaign;
    step: number;
    success: boolean;
    isClosing: boolean;
    isFetched: boolean;
    action: "create" | "edit" | "draft";

    // Actions
    setCampaign: (campaign: Campaign) => void;
    setStep: (step: number | ((prev: number) => number)) => void;
    setSuccess: (success: boolean) => void;
    setIsClosing: (isClosing: boolean) => void;
    setIsFetched: (isFetched: boolean) => void;
    setAction: (action: "create" | "edit" | "draft") => void;
    reset: () => void;
};

/**
 * Store for campaign creation workflow
 * Combines campaign data, step navigation, and UI state
 */
export const campaignStore = create<CampaignState>()(
    persist(
        (set) => ({
            // Initial state
            campaign: initialValues,
            step: 1,
            success: false,
            isClosing: false,
            isFetched: false,
            action: "create",

            // Actions
            setCampaign: (campaign) => set({ campaign }),

            setStep: (step) =>
                set((state) => ({
                    step: typeof step === "function" ? step(state.step) : step,
                })),

            setSuccess: (success) => set({ success }),

            setIsClosing: (isClosing) => set({ isClosing }),

            setIsFetched: (isFetched) => set({ isFetched }),

            setAction: (action) => set({ action }),

            reset: () =>
                set({
                    campaign: initialValues,
                    step: 1,
                    success: false,
                    isClosing: false,
                    isFetched: false,
                    action: "create",
                }),
        }),
        {
            name: "campaign",
            partialize: (state) => ({
                campaign: state.campaign,
                step: state.step,
                success: state.success,
                isClosing: state.isClosing,
            }),
        }
    )
);
