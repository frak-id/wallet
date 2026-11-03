import { ConfirmationTooltip } from "@frak-labs/design-system/components/ConfirmationTooltip";
import { alias } from "@frak-labs/design-system/tokens";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import * as styles from "./celebration.css";

const TOAST_VISIBLE_MS = 2400;
const TOAST_EXIT_MS = 220;

/** The shell toast the wallet raises once earnings land, then dismisses. */
export function CollectedToast({ label }: { label: string }) {
    const [state, setState] = useState<"shown" | "leaving" | "gone">("shown");

    useEffect(() => {
        if (state === "gone") return;
        const timer = window.setTimeout(
            () => setState(state === "shown" ? "leaving" : "gone"),
            state === "shown" ? TOAST_VISIBLE_MS : TOAST_EXIT_MS
        );
        return () => window.clearTimeout(timer);
    }, [state]);

    if (state === "gone") return null;
    return (
        <div className={styles.toastSlot}>
            <ConfirmationTooltip isLeaving={state === "leaving"}>
                {label}
            </ConfirmationTooltip>
        </div>
    );
}

const COLORS = [
    alias.primary[500],
    alias.primary[300],
    alias.success[500],
    alias.success[300],
    alias.warning[400],
];

/** Fixed spread so every replay of the demo bursts the same way. */
const PIECES = Array.from({ length: 26 }, (_, i) => {
    const angle = (i / 26) * Math.PI * 2 + (i % 3) * 0.21;
    const distance = 90 + ((i * 37) % 70);
    return {
        id: i,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance * 0.8 - 30,
        rotate: ((i * 83) % 360) - 180,
        color: COLORS[i % COLORS.length],
        delay: (i % 5) * 0.02,
    };
});

/** A short confetti burst above the balance. */
export function Confetti() {
    return (
        <div className={styles.burst} aria-hidden="true">
            {PIECES.map((piece) => (
                <motion.span
                    key={piece.id}
                    className={styles.piece}
                    style={{ background: piece.color }}
                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.4, rotate: 0 }}
                    animate={{
                        x: piece.x,
                        y: [0, piece.y, piece.y + 120],
                        opacity: [1, 1, 0],
                        scale: 1,
                        rotate: piece.rotate,
                    }}
                    transition={{
                        duration: 1.5,
                        delay: piece.delay,
                        ease: "easeOut",
                        times: [0, 0.45, 1],
                    }}
                />
            ))}
        </div>
    );
}
