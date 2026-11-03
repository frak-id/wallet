import type { ReactNode } from "react";
import type { Friend } from "../friends";
import * as styles from "./avatar.css";

type Ring = "story" | "seen" | "none";

/** Instagram's story ring around any avatar; `size` is the outer diameter, as for `PersonaAvatar`. */
export function StoryRing({
    size,
    ring,
    children,
}: {
    size: number;
    ring: Ring;
    children: ReactNode;
}) {
    if (ring === "none") {
        return (
            <span className={styles.bare} style={{ width: size, height: size }}>
                {children}
            </span>
        );
    }
    return (
        <span
            className={styles.ring({ ring })}
            style={{ width: size, height: size }}
        >
            <span className={styles.gap}>
                <span className={styles.inner}>{children}</span>
            </span>
        </span>
    );
}

/** A friend without illustrated art: initials on a soft gradient, like a contact photo. */
export function InitialsAvatar({
    friend,
    size,
    ring = "none",
}: {
    friend: Pick<Friend, "name" | "tones">;
    size: number;
    ring?: Ring;
}) {
    const [from, to] = friend.tones;
    return (
        <StoryRing size={size} ring={ring}>
            <span
                className={styles.initials}
                style={{
                    background: `linear-gradient(140deg, ${from}, ${to})`,
                    fontSize: size * 0.36,
                }}
            >
                {friend.name.charAt(0)}
            </span>
        </StoryRing>
    );
}
