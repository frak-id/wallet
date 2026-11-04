import { useCallback, useEffect, useRef, useState } from "react";

export type PasskeyStage = "idle" | "sheet" | "scanning" | "verified" | "ready";

/** How long each automatic stage lasts before the next one, in ms. */
const STAGE_MS: Partial<Record<PasskeyStage, number>> = {
    scanning: 1100,
    verified: 650,
    ready: 1500,
};

const NEXT_STAGE: Partial<Record<PasskeyStage, PasskeyStage>> = {
    scanning: "verified",
    verified: "ready",
};

/**
 * Passkey registration as the OS plays it: system sheet, Face ID scan, check,
 * then a short "wallet ready" beat before `onReady`.
 */
export function usePasskeyFlow(onReady: () => void) {
    const [stage, setStage] = useState<PasskeyStage>("idle");
    const onReadyRef = useRef(onReady);
    useEffect(() => {
        onReadyRef.current = onReady;
    });

    useEffect(() => {
        const duration = STAGE_MS[stage];
        if (duration === undefined) return;
        const timer = window.setTimeout(() => {
            const next = NEXT_STAGE[stage];
            if (next) setStage(next);
            else onReadyRef.current();
        }, duration);
        return () => window.clearTimeout(timer);
    }, [stage]);

    const open = useCallback(
        () => setStage((s) => (s === "idle" ? "sheet" : s)),
        []
    );
    const confirm = useCallback(
        () => setStage((s) => (s === "sheet" ? "scanning" : s)),
        []
    );
    return { stage, open, confirm };
}
