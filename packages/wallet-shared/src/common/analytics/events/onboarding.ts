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
};

export type OnboardingEventMap = OnboardingFlow & OnboardingMidFlowEvents;
