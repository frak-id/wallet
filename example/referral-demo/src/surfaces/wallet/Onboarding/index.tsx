import { Button } from "@frak-labs/design-system/components/Button";
import { ArrowLeftIcon } from "@frak-labs/design-system/icons";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { useDemoNav } from "@/core/store";
import { useT } from "@/i18n";
import type { OnboardingProps } from "@/surfaces/contracts";
import {
    OnboardingHero,
    type OnboardingStepId,
} from "../components/OnboardingHero";
import { walletMessages } from "../messages";
import * as styles from "./onboarding.css";

const STEPS: readonly OnboardingStepId[] = ["one", "two", "three"];

const CTA = {
    one: "onboarding.start",
    two: "onboarding.continue",
    three: "onboarding.activate",
} as const;

/** The wallet's slide-and-fade between onboarding steps (24px, 200ms, decelerate). */
const slide = {
    initial: (direction: number) => ({ x: 24 * direction, opacity: 0 }),
    animate: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: -24 * direction, opacity: 0 }),
};

/** One onboarding screen, as `register.tsx` lays it out. */
export function OnboardingPage({
    step,
    onContinue,
    onBack,
    loading,
}: {
    step: OnboardingStepId;
    onContinue: () => void;
    onBack?: () => void;
    loading?: boolean;
}) {
    const t = useT(walletMessages);
    const index = STEPS.indexOf(step);
    return (
        <div className={styles.page}>
            {step !== "one" && (
                <div className={styles.header}>
                    <button
                        type="button"
                        className={styles.backButton}
                        aria-label={t("common.back")}
                        onClick={onBack}
                    >
                        <ArrowLeftIcon width={24} height={24} />
                    </button>
                </div>
            )}
            <OnboardingHero step={step} />
            <div className={styles.footer}>
                <div className={styles.dots} aria-hidden="true">
                    {STEPS.map((id, i) => (
                        <span
                            key={id}
                            className={styles.dot({ active: i === index })}
                        />
                    ))}
                </div>
                <Button onClick={onContinue} loading={loading}>
                    {t(CTA[step])}
                </Button>
                {step === "one" && (
                    <Button variant="secondary">
                        {t("onboarding.alreadyHaveAccount")}
                    </Button>
                )}
            </div>
        </div>
    );
}

export function Onboarding(_props: OnboardingProps) {
    const { next } = useDemoNav();
    const [[index, direction], setPosition] = useState<[number, number]>([
        0, 1,
    ]);
    const step = STEPS[index] ?? "one";

    const goTo = (target: number) =>
        setPosition([target, target > index ? 1 : -1]);

    return (
        <div className={styles.screen}>
            <AnimatePresence initial={false} custom={direction}>
                <motion.div
                    key={step}
                    className={styles.screen}
                    custom={direction}
                    variants={slide}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                >
                    <OnboardingPage
                        step={step}
                        onBack={() => goTo(Math.max(0, index - 1))}
                        onContinue={() =>
                            index < STEPS.length - 1 ? goTo(index + 1) : next()
                        }
                    />
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
