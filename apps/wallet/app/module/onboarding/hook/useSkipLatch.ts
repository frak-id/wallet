import { useCallback, useEffect, useRef } from "react";
import type { FlowStep } from "@/module/onboarding/hook/useRegisterFlow";

/**
 * Guards the onboarding skip against a double-tap. Step transitions are async
 * (view transitions), so the button stays mounted and clickable for a beat
 * after the first tap.
 *
 * The latch is set at click time and cleared once the new step commits, so
 * re-entering a step — back from the secure-space screen, cancelling the
 * pairing keypass — re-arms it.
 */
export function useSkipLatch(step: FlowStep) {
    const stepRef = useRef(step);
    stepRef.current = step;

    const latchRef = useRef<FlowStep | null>(null);
    useEffect(() => {
        latchRef.current = null;
    }, [step]);

    return useCallback((onSkip: () => void) => {
        if (latchRef.current === stepRef.current) return;
        latchRef.current = stepRef.current;
        onSkip();
    }, []);
}
