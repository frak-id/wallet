import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { type FrameMode, useDemoStore } from "@/core/store";
import { useT } from "@/i18n";
import { shellMessages } from "../messages";
import { DirectorContent } from "./DirectorContent";
import * as styles from "./director.css";

const FRAME_CYCLE: Record<FrameMode, FrameMode> = {
    auto: "on",
    on: "off",
    off: "auto",
};

type DemoState = ReturnType<typeof useDemoStore.getState>;

const SHORTCUTS: Record<string, (state: DemoState) => void> = {
    ArrowRight: (s) => s.next(),
    PageDown: (s) => s.next(),
    ArrowLeft: (s) => s.prev(),
    PageUp: (s) => s.prev(),
    Home: (s) => s.restart(),
    l: (s) => s.setLang(s.lang === "fr" ? "en" : "fr"),
    f: (s) => s.setFrame(FRAME_CYCLE[s.frame]),
};

/** Arrow keys and presentation clickers drive the demo. */
export function useDirectorShortcuts() {
    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            const target = event.target as HTMLElement | null;
            if (target?.closest("input, textarea, [contenteditable]")) return;
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (event.repeat) return;
            const action =
                SHORTCUTS[event.key] ?? SHORTCUTS[event.key.toLowerCase()];
            if (!action) return;
            event.preventDefault();
            action(useDemoStore.getState());
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);
}

/** Always-on presenter panel next to the phone, on wide screens. */
export function DirectorPanel() {
    return (
        <aside className={styles.panel}>
            <DirectorContent />
        </aside>
    );
}

/** A discreet button that opens the presenter controls, on phones and tablets. */
export function DirectorFab() {
    const t = useT(shellMessages);
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                className={styles.fab}
                aria-label={t("director.open")}
                onClick={() => setOpen(true)}
            >
                <svg
                    width="6"
                    height="24"
                    viewBox="0 0 6 24"
                    aria-hidden="true"
                >
                    <path
                        d="M1.5 2v20M4.5 2v20"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                    />
                </svg>
            </button>
            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            key="backdrop"
                            className={styles.sheetBackdrop}
                            onClick={() => setOpen(false)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        />
                        <motion.div
                            key="sheet"
                            className={styles.sheet}
                            role="dialog"
                            aria-label={t("director.title")}
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{
                                type: "spring",
                                damping: 32,
                                stiffness: 320,
                            }}
                        >
                            <div className={styles.sheetHandle} />
                            <DirectorContent onJump={() => setOpen(false)} />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
