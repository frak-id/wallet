import { useEffect } from "react";
import { create } from "zustand";

const useHolds = create<{ count: number }>(() => ({ count: 0 }));

/** Keeps the continue prompt away while `hold` is true, e.g. while a sheet waits for its tap. */
export function useHoldContinue(hold: boolean) {
    useEffect(() => {
        if (!hold) return;
        useHolds.setState((s) => ({ count: s.count + 1 }));
        return () => useHolds.setState((s) => ({ count: s.count - 1 }));
    }, [hold]);
}

export function useContinueHeld(): boolean {
    return useHolds((s) => s.count > 0);
}
