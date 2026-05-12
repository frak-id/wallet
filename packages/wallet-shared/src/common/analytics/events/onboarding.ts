import type { FlowEvents } from "./flow";

export type OnboardingAction =
    | "start"
    | "continue"
    | "activate_secure_space"
    | "login"
    | "recovery_code";

type OnboardingBaseProps = {
    flow_id?: string;
};

export type ReferralCodeOutcome =
    | "applied"
    | "skipped"
    | "auto_skipped_existing"
    | "error";

type OnboardingFlow = FlowEvents<"onboarding">;

type OnboardingMidFlowEvents = {
    onboarding_slide_viewed: OnboardingBaseProps & {
        index: number;
        translation_key: string;
    };
    onboarding_action_clicked: OnboardingBaseProps & {
        action: OnboardingAction;
        slide_index?: number;
    };
    referral_code_viewed: OnboardingBaseProps | undefined;
    referral_code_resolved: OnboardingBaseProps & {
        outcome: ReferralCodeOutcome;
        error_key?: string;
    };
};

export type OnboardingEventMap = OnboardingFlow & OnboardingMidFlowEvents;
