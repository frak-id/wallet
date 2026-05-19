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

export type EmailInputOutcome = "submitted" | "back" | "login_existing";

type OnboardingFlow = FlowEvents<"onboarding">;

type OnboardingMidFlowEvents = {
    // Legacy name: kept as `*_slide_viewed` to preserve analytics history.
    // The onboarding UI now uses "step" lexicon (see OnboardingStep);
    // do not rename without coordinating with downstream dashboards.
    onboarding_slide_viewed: OnboardingBaseProps & {
        index: number;
        translation_key: string;
    };
    onboarding_action_clicked: OnboardingBaseProps & {
        action: OnboardingAction;
    };
    referral_code_viewed: OnboardingBaseProps | undefined;
    referral_code_resolved: OnboardingBaseProps & {
        outcome: ReferralCodeOutcome;
        error_key?: string;
    };
    // Fires once when the user lands on the `emailInput` onboarding step.
    email_input_viewed: OnboardingBaseProps | undefined;
    // Fires when the user leaves the email step: `submitted` advances the
    // flow, `back` returns to the previous step, `login_existing` triggers
    // a login mutation when the entered email is already attached to a wallet.
    email_input_resolved: OnboardingBaseProps & {
        outcome: EmailInputOutcome;
    };
};

export type OnboardingEventMap = OnboardingFlow & OnboardingMidFlowEvents;
