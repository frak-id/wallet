import { type Flow, startFlow } from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { onboardingSteps } from "@/module/onboarding/component/step/onboardingSteps";
import {
    type StepTransitionDirection,
    withStepTransition,
} from "@/module/onboarding/utils/stepTransition";

export const ONBOARDING_FLOW_STEPS = [
    "onboardingOne",
    "onboardingTwo",
    "onboardingThree",
] as const;

export type OnboardingFlowStep = (typeof ONBOARDING_FLOW_STEPS)[number];

export type FlowStep =
    | OnboardingFlowStep
    | "emailInput"
    | "emailAlreadyUsed"
    | "referralCode"
    | "notification"
    | "welcome";

export type GoToStep = (
    next: FlowStep,
    direction?: StepTransitionDirection
) => void;

/**
 * Resolve the starting onboarding step. Arriving from `/login/email` with a
 * confirmed-unused prefilled email jumps straight to the secure-space step —
 * the email collection step would just re-ask for something already typed.
 * Otherwise start at the first marketing slide.
 */
export function resolveInitialRegisterStep(prefilledEmail?: string): FlowStep {
    return prefilledEmail ? "onboardingThree" : "onboardingOne";
}

/**
 * Owns the onboarding step state machine: the current step, the transition
 * helper, the flow analytics handle, and the per-step "viewed" tracking.
 *
 * `onBeforeTransition` runs before every `goToStep` — the register page uses it
 * to clear its transient login error.
 */
export function useRegisterFlow({
    prefilledEmail,
    onBeforeTransition,
}: {
    prefilledEmail?: string;
    onBeforeTransition?: () => void;
}) {
    const [step, setStep] = useState<FlowStep>(() =>
        resolveInitialRegisterStep(prefilledEmail)
    );
    const flowRef = useRef<Flow | null>(null);

    // Hold the latest callback in a ref so `goToStep` keeps a stable identity
    // across renders — effects that depend on it (referral / notification
    // auto-skip) must not re-run every render, which would double-fire their
    // resolution tracking during the async view-transition window.
    const onBeforeTransitionRef = useRef(onBeforeTransition);
    onBeforeTransitionRef.current = onBeforeTransition;

    const goToStep = useCallback<GoToStep>((next, direction = "forward") => {
        onBeforeTransitionRef.current?.();
        withStepTransition(direction, () => setStep(next));
    }, []);

    // Start the onboarding flow on mount, end as "abandoned" if never succeeded
    useEffect(() => {
        const flow = startFlow("onboarding");
        flowRef.current = flow;
        return () => {
            if (!flow.ended) flow.end("abandoned", { last_step: step });
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fire on each onboarding step entry. Event name keeps the legacy
    // `*_slide_viewed` suffix for analytics-history continuity even though
    // the UI no longer uses a slider — see the event declaration in
    // `packages/wallet-shared/src/common/analytics/events/onboarding.ts`.
    useEffect(() => {
        const index = ONBOARDING_FLOW_STEPS.indexOf(step as OnboardingFlowStep);
        if (index === -1) return;
        flowRef.current?.track("onboarding_slide_viewed", {
            index,
            translation_key:
                onboardingSteps[index]?.translationKey ?? "unknown",
        });
    }, [step]);

    // Fire `email_input_viewed` once we land on the email step
    useEffect(() => {
        if (step === "emailInput") {
            flowRef.current?.track("email_input_viewed");
        }
    }, [step]);

    // Fire `referral_code_viewed` once we land on that step
    useEffect(() => {
        if (step === "referralCode") {
            flowRef.current?.track("referral_code_viewed");
        }
    }, [step]);

    // Fire `notification_opt_in_viewed` once we land on that step
    useEffect(() => {
        if (step === "notification") {
            flowRef.current?.track("notification_opt_in_viewed");
        }
    }, [step]);

    return { step, goToStep, flowRef };
}
