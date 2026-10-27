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
    | "gameRules"
    | "gameReward"
    | "emailInput"
    | "emailAlreadyUsed"
    | "referralCode"
    | "notification"
    | "welcome";

// Module scope: leaving for `/reward-code` or `/login` and coming back remounts the page but continues the same onboarding.
let onboardingFlow: Flow | null = null;
// Live step while `/register` is mounted; only the mounted page may resume a flow the user hid.
let pageStepRef: { readonly current: FlowStep } | null = null;
let lastStep: FlowStep = "onboardingOne";

// Closing the tab or killing the app never unmounts React: hiding is the last moment to report the step.
function onVisibilityChange() {
    if (document.visibilityState === "hidden") {
        onboardingFlow?.end("abandoned", {
            last_step: pageStepRef?.current ?? lastStep,
        });
    } else if (pageStepRef) {
        onboardingFlow?.reopen();
    }
}

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

    // Mirror the latest step into a ref so mount-scoped cleanups and async
    // callbacks read the step the user is actually on. Reading `step` straight
    // from a closure would freeze it at the value captured when the callback
    // was created.
    const stepRef = useRef(step);
    stepRef.current = step;

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

    useEffect(() => {
        onboardingFlow?.reopen();
        if (!onboardingFlow || onboardingFlow.ended) {
            onboardingFlow = startFlow("onboarding");
        }
        flowRef.current = onboardingFlow;
        pageStepRef = stepRef;
        // Never removed: a user who leaves `/register` for a login still ends the flow on the next hide.
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            lastStep = stepRef.current;
            pageStepRef = null;
        };
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

    // Fire `game_step_viewed` once we land on a Frak Game step
    useEffect(() => {
        if (step === "gameRules" || step === "gameReward") {
            flowRef.current?.track("game_step_viewed", {
                step: step === "gameRules" ? "rules" : "reward",
            });
        }
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

    return { step, stepRef, goToStep, flowRef };
}
