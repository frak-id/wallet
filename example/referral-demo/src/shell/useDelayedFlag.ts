import { useEffect, useState } from "react";

/** `false` on mount, `true` once `ms` have passed: hints and late-resolving UI. */
export function useDelayedFlag(ms: number): boolean {
    const [on, setOn] = useState(false);
    useEffect(() => {
        const timer = window.setTimeout(() => setOn(true), ms);
        return () => window.clearTimeout(timer);
    }, [ms]);
    return on;
}
