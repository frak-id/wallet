import type { ReactNode } from "react";
import * as styles from "./tapHalo.css";

/**
 * A ring pulsing around a pill button once `active`, after a beat, to point
 * the presenter at the next tap. The button itself never moves.
 */
export function TapHalo({
    active,
    fill = true,
    children,
}: {
    active: boolean;
    /** Stretches to the parent's width, like a full-width button. */
    fill?: boolean;
    children: ReactNode;
}) {
    return (
        <span className={styles.wrapper({ fill })}>
            {children}
            {active && <span className={styles.ring} aria-hidden="true" />}
        </span>
    );
}
