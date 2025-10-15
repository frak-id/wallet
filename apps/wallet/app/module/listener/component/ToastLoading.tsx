import { useIsMutating } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Toast } from "@/module/common/component/Toast";
import { useSdkCleanup } from "../hooks/useSdkCleanup";
import styles from "./ToastLoading.module.css";

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
        <Toast
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
                                className={styles.toastStuck__button}
                            />
                        ),
                        pLink: (
                            <Link
                                to="https://frak.id/ressources#troubleshooting"
                                target="_blank"
                                className={styles.toastStuck__link}
                            />
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
