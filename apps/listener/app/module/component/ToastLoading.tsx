import { useIsMutating } from "@tanstack/react-query";
import {
    type MouseEvent,
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { Trans, useTranslation } from "react-i18next";
import { useSdkCleanup } from "../hooks/useSdkCleanup";
import * as styles from "./ToastLoading.css";

export function ToastLoading() {
    const { t } = useTranslation();
    const cleanup = useSdkCleanup();
    const isMutating = useIsMutating();
    const [showStuck, setShowStuck] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /**
     * Start the stuck timer
     * @description This is used to show the stuck toast after 5 seconds of inactivity
     */
    const startStuckTimer = useCallback(() => {
        setShowStuck(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setShowStuck(true);
        }, 10_000);
    }, []);

    /**
     * Track mutation start and reset the stuck timer
     * @description This is used to show the stuck toast after 5 seconds of inactivity and if the mutation is still in progress
     * @note If the mutation is not in progress, we reset the stuck timer and hide the toast
     */
    useEffect(() => {
        if (isMutating > 0) {
            startStuckTimer();
            return;
        }

        // Reset everything if no mutation
        setShowStuck(false);
        if (timerRef.current) clearTimeout(timerRef.current);

        return () => {
            setShowStuck(false);
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [isMutating, startStuckTimer]);

    // Early exit if we don't have any mutation in progress
    if (isMutating < 1) return null;

    // before the 5sec threshold, display nothing
    if (!showStuck) return null;

    // after 5sec after the mutating is unchanged, link to the troubleshooting section + the button to logout and redo a login / pairing (cleanup hook)
    return (
        <StuckToast
            text={
                <Trans
                    i18nKey="wallet.toastLoading.stuck"
                    components={{
                        button: (
                            <button
                                type="button"
                                onClick={() => {
                                    cleanup();
                                    startStuckTimer();
                                }}
                                className={styles.toastStuckButton}
                            />
                        ),
                        pLink: (
                            <a
                                href="https://frak.id/ressources#troubleshooting"
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.toastStuckLink}
                            >
                                troubleshooting
                            </a>
                        ),
                    }}
                />
            }
            ariaLabel={t("wallet.toastLoading.stuck")}
            ariaDismissLabel={t("wallet.toastLoading.dismiss")}
            onDismiss={() => {
                setShowStuck(false);
                startStuckTimer();
            }}
        />
    );
}

/**
 * Inlined dismissible warning banner. Replaces the deleted wallet-shared
 * `Toast` + `Warning` components — same dark glass appearance, same close
 * button, scoped to this single consumer.
 */
function StuckToast({
    text,
    ariaLabel,
    ariaDismissLabel,
    onDismiss,
}: {
    text: ReactNode;
    ariaLabel: string;
    ariaDismissLabel: string;
    onDismiss: (e: MouseEvent) => void;
}) {
    return (
        <div className={styles.toast} role="status" aria-label={ariaLabel}>
            <div className={styles.warning}>
                <p className={styles.warningContent}>
                    <span className={styles.warningGlyph}>&#9888;</span> {text}
                </p>
            </div>
            <button
                type="button"
                onClick={onDismiss}
                className={styles.dismissButton}
                aria-label={ariaDismissLabel}
            >
                <CloseIcon />
            </button>
        </div>
    );
}

/**
 * Inlined `X` glyph (lucide-react geometry) so the toast doesn't pull
 * lucide-react into the eager listener bundle path.
 */
function CloseIcon() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
        </svg>
    );
}
