import { AnimatePresence, motion, type Variants } from "motion/react";
import { useEffect, useRef } from "react";
import { StepScope } from "@/core/stepScope";
import { chromeKey, type StepDef, steps } from "@/core/steps";
import { useDemoStore } from "@/core/store";
import { ContinuePrompt } from "../ContinuePrompt";
import { ChromeFrame } from "../chrome";
import { OverlayHosts } from "../DeviceOverlay";
import * as styles from "./stepStage.css";

type Direction = 1 | -1;
type Enter = NonNullable<StepDef["enter"]>;

const ease = [0.32, 0.72, 0, 1] as const;

/** Switching app (Safari → Instagram → wallet): the new one zooms in. */
const appSwitch: Variants = {
    initial: (direction: Direction) => ({
        opacity: 0,
        scale: direction > 0 ? 0.94 : 1.04,
    }),
    animate: { opacity: 1, scale: 1, transition: { duration: 0.42, ease } },
    exit: (direction: Direction) => ({
        opacity: 0,
        scale: direction > 0 ? 1.03 : 0.95,
        pointerEvents: "none",
        transition: { duration: 0.3, ease },
    }),
};

/** Navigating inside the same app or browser. */
const page: Record<Enter, Variants> = {
    slide: {
        initial: (direction: Direction) => ({
            x: direction > 0 ? "100%" : "-30%",
            opacity: direction > 0 ? 1 : 0.6,
        }),
        animate: { x: 0, opacity: 1, transition: { duration: 0.42, ease } },
        exit: (direction: Direction) => ({
            pointerEvents: "none",
            x: direction > 0 ? "-30%" : "100%",
            opacity: direction > 0 ? 0.6 : 1,
            transition: { duration: 0.42, ease },
        }),
    },
    fade: {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.35 } },
        exit: {
            opacity: 0,
            pointerEvents: "none",
            transition: { duration: 0.25 },
        },
    },
    instant: {
        initial: { opacity: 1 },
        animate: { opacity: 1 },
        exit: { opacity: 0, transition: { duration: 0 } },
    },
};

/**
 * `true` during a component's first render only. Layers use it instead of
 * `<AnimatePresence initial={false}>`, whose context would also block the
 * entrance of everything mounted inside the layer for as long as it lives.
 */
function useFirstRender(): boolean {
    const first = useRef(true);
    useEffect(() => {
        first.current = false;
    }, []);
    return first.current;
}

/** The pages of one chrome: the first one is simply there, later ones slide or fade in. */
function Pages({ step, direction }: { step: StepDef; direction: Direction }) {
    const first = useFirstRender();
    return (
        <AnimatePresence custom={direction}>
            <motion.div
                key={step.id}
                className={styles.layer}
                custom={direction}
                variants={page[step.enter ?? "slide"]}
                initial={first ? false : "initial"}
                animate="animate"
                exit="exit"
            >
                <StepScope stepId={step.id}>{step.render()}</StepScope>
            </motion.div>
        </AnimatePresence>
    );
}

/** Renders the current step inside its chrome, animating between steps. */
export function StepStage() {
    const stepId = useDemoStore((s) => s.stepId);
    const direction = useDemoStore((s) => s.direction);
    const step = steps[stepId];
    const first = useFirstRender();

    return (
        <div className={styles.stage}>
            <AnimatePresence custom={direction}>
                <motion.div
                    key={chromeKey(step)}
                    className={styles.layer}
                    custom={direction}
                    variants={appSwitch}
                    initial={first ? false : "initial"}
                    animate="animate"
                    exit="exit"
                >
                    <ChromeFrame chrome={step.chrome}>
                        <Pages step={step} direction={direction} />
                    </ChromeFrame>
                    <OverlayHosts stepId={step.id} />
                </motion.div>
            </AnimatePresence>
            {step.final && <ContinuePrompt key={step.id} />}
        </div>
    );
}
