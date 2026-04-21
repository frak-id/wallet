import type { FlowEvents } from "./flow";

export type OnboardingStep = "onboarding" | "notification" | "welcome";
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
    onboarding_keypass_opened: OnboardingBaseProps | undefined;
    onboarding_step_advanced: OnboardingBaseProps & {
        from: OnboardingStep;
        to: OnboardingStep;
    };
};

export type OnboardingEventMap = OnboardingFlow & OnboardingMidFlowEvents;
