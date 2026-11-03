import { LogoFrak } from "@frak-labs/design-system/icons";
import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { scenarioOf } from "@/core/stepIds";
import { useDemoNav, useDemoStore } from "@/core/store";
import { useT } from "@/i18n";
import { shellMessages } from "../messages";
import * as styles from "./continuePrompt.css";
import { useContinueHeld } from "./hold";

function PromptButton() {
    const t = useT(shellMessages);
    const { next } = useDemoNav();
    const scenario = useDemoStore((s) => scenarioOf(s.stepId));
    // Invisible for its first seconds: it must not catch taps meant for the screen below.
    const [shown, setShown] = useState(false);

    return (
        <motion.button
            type="button"
            className={styles.prompt({ shown })}
            onClick={next}
            onAnimationComplete={() => setShown(true)}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24, transition: { duration: 0.2 } }}
            transition={{
                delay: 2.4,
                duration: 0.45,
                ease: [0.32, 0.72, 0, 1],
            }}
        >
            <span className={styles.logo}>
                <LogoFrak width={14} height={14} />
            </span>
            {t(
                scenario === "referee"
                    ? "continue.referee"
                    : "continue.referrer"
            )}
            <span aria-hidden="true">→</span>
        </motion.button>
    );
}

/** Floating hand-off to the next scenario once a scenario's last screen settles. */
export function ContinuePrompt() {
    const held = useContinueHeld();
    return <AnimatePresence>{!held && <PromptButton />}</AnimatePresence>;
}
