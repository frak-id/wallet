import { useCallback, useEffect, useRef, useState } from "react";
import type { TooltipData } from "./chart-context";

export function useScheduledTooltip() {
    const [tooltipData, setTooltipData] = useState<TooltipData | null>(null);
    const lastKeyRef = useRef<string | null>(null);
    const pendingRef = useRef<TooltipData | null>(null);
    const rafRef = useRef<number | null>(null);
    const pendingKeyRef = useRef<string | null>(null);

    useEffect(() => {
        return () => {
            if (rafRef.current !== null) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, []);

    const commitTooltip = useCallback(
        (tooltip: TooltipData, dedupeKey: string) => {
            if (dedupeKey === lastKeyRef.current) {
                return;
            }
            lastKeyRef.current = dedupeKey;
            setTooltipData(tooltip);
        },
        []
    );

    const scheduleTooltip = useCallback(
        (tooltip: TooltipData) => {
            const key = String(tooltip.index);
            pendingRef.current = tooltip;
            pendingKeyRef.current = key;
            if (key === lastKeyRef.current) {
                return;
            }
            if (rafRef.current !== null) {
                return;
            }
            rafRef.current = requestAnimationFrame(() => {
                rafRef.current = null;
                const next = pendingRef.current;
                const nextKey = pendingKeyRef.current;
                if (next && nextKey) {
                    commitTooltip(next, nextKey);
                }
            });
        },
        [commitTooltip]
    );

    const clearTooltip = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        pendingRef.current = null;
        pendingKeyRef.current = null;
        lastKeyRef.current = null;
        setTooltipData(null);
    }, []);

    const resetTooltipDedupe = useCallback(() => {
        lastKeyRef.current = null;
    }, []);

    return {
        tooltipData,
        scheduleTooltip,
        clearTooltip,
        resetTooltipDedupe,
    };
}
