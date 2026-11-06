import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useCallback } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import type { StepId } from "@/core/stepIds";
import { useOwnStep } from "@/core/stepScope";
import * as styles from "./deviceOverlay.css";

const useHosts = create<Partial<Record<StepId, HTMLElement>>>(() => ({}));

function OverlayHost({ stepId }: { stepId: StepId }) {
    const register = useCallback(
        (node: HTMLDivElement | null) =>
            useHosts.setState({ [stepId]: node ?? undefined }),
        [stepId]
    );
    return (
        <motion.div
            ref={register}
            className={styles.host}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
        />
    );
}

/** One host per step, above the chrome, fading out with the step it belongs to. */
export function OverlayHosts({ stepId }: { stepId: StepId }) {
    return (
        <AnimatePresence initial={false}>
            <OverlayHost key={stepId} stepId={stepId} />
        </AnimatePresence>
    );
}

/**
 * Renders system UI (share sheet, Apple Pay, passkey prompt…) over the whole
 * phone screen, browser toolbar included, like iOS does. Position children
 * absolutely and pad the bottom with `deviceInset.bottom`.
 */
export function DeviceOverlay({ children }: { children: ReactNode }) {
    const stepId = useOwnStep();
    const host = useHosts((s) => (stepId ? s[stepId] : undefined));
    if (!stepId) return children;
    if (!host) return null;
    return createPortal(children, host);
}
