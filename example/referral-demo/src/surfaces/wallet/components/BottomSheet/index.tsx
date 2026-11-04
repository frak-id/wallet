import type { RecipeVariants } from "@vanilla-extract/recipes";
import { AnimatePresence, motion } from "motion/react";
import type { ReactNode } from "react";
import { DeviceOverlay } from "@/shell/DeviceOverlay";
import * as styles from "./bottomSheet.css";

type SheetLook = NonNullable<
    NonNullable<RecipeVariants<typeof styles.sheet>>["look"]
>;

const spring = {
    type: "spring",
    damping: 34,
    stiffness: 340,
    mass: 0.9,
} as const;

/**
 * A sheet over a dimmed backdrop, drawn inside the phone. `system` is the
 * floating iOS sheet, `frak` the wallet's drawer, `store` the App Store page.
 */
export function BottomSheet({
    open,
    look,
    label,
    handle = look === "frak",
    children,
}: {
    open: boolean;
    look: SheetLook;
    label: string;
    /** The drawer's grab handle; Frak's modals hide it. */
    handle?: boolean;
    children: ReactNode;
}) {
    return (
        <DeviceOverlay>
            <AnimatePresence>
                {open && (
                    <motion.div
                        key="backdrop"
                        className={styles.backdrop({ look })}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.28 }}
                    />
                )}
                {open && (
                    <motion.div
                        key="sheet"
                        role="dialog"
                        aria-label={label}
                        className={styles.sheet({ look })}
                        initial={{ y: "110%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "110%", transition: { duration: 0.28 } }}
                        transition={spring}
                    >
                        {handle && <span className={styles.handle} />}
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </DeviceOverlay>
    );
}
