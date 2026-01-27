import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
    BudgetConfigItem,
    CampaignGoal,
    CampaignTrigger,
    RewardChaining,
    RewardRecipient,
    SpecialCategory,
} from "@/types/Campaign";

/**
 * Campaign form state for creation wizard
 * Holds in-progress form data, not the full backend response
 */
type CampaignFormData = {
    name: string;
    merchantId: string;
    goal: CampaignGoal | undefined;
    specialCategories: SpecialCategory[];
    territories: string[];
    budget: BudgetConfigItem | undefined;
    scheduled: {
        dateStart: Date;
        dateEnd?: Date;
    };
    trigger: CampaignTrigger;
    rewardAmount: number;
    rewardRecipient: RewardRecipient;
    rewardChaining?: RewardChaining;
    priority: number;
};

const initialValues: CampaignFormData = {
    name: "",
    merchantId: "",
    goal: undefined,
    specialCategories: [],
    territories: [],
    budget: undefined,
    scheduled: {
        dateStart: new Date(),
    },
    trigger: "purchase",
    rewardAmount: 0,
    rewardRecipient: "referrer",
    priority: 0,
};

type CampaignState = {
    // State
    campaign: CampaignFormData;
    step: number;
    success: boolean;
    isClosing: boolean;
    isFetched: boolean;
    action: "create" | "edit" | "draft";

    // Actions
    setCampaign: (campaign: CampaignFormData) => void;
    setStep: (step: number | ((prev: number) => number)) => void;
    setSuccess: (success: boolean) => void;
    setIsClosing: (isClosing: boolean) => void;
    setIsFetched: (isFetched: boolean) => void;
    setAction: (action: "create" | "edit" | "draft") => void;
    reset: () => void;
};

/**
 * Store for campaign creation workflow
 * Combines campaign form data, step navigation, and UI state
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
            name: "campaign-v2",
            partialize: (state) => ({
                campaign: state.campaign,
                step: state.step,
                success: state.success,
                isClosing: state.isClosing,
            }),
        }
    )
);
