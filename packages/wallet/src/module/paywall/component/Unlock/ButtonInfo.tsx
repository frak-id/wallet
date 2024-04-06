import styles from "@/module/paywall/component/Unlock/index.module.css";
import { usePaywallRedirection } from "@/module/paywall/hook/usePaywallRedirection";
import type { PaywallUnlockUiState } from "@/types/Unlock";
import { useEffect } from "react";

/**
 * When the unlock is currently in the process
 * @param loading
 * @constructor
 */
export function UnlockIdle({ idle }: { idle: PaywallUnlockUiState["idle"] }) {
    if (!idle) {
        return null;
    }

    return <>Click to launch the unlock</>;
}

/**
 * When the unlock is currently in the process
 * @param loading
 * @constructor
 */
export function UnlockLoading({
    loading,
}: { loading: PaywallUnlockUiState["loading"] }) {
    if (!loading) {
        return null;
    }

    return (
        <>
            <span className={styles.unlock__loading}>
                Crafting the unlock transaction
                <span className={"dotsLoading"}>...</span>
            </span>
        </>
    );
}

/**
 * When the user face an error during the unlock process
 * @param error
 * @constructor
 */
export function UnlockError({
    error,
}: { error: PaywallUnlockUiState["error"] }) {
    if (!error) {
        return null;
    }

    return (
        <>
            An error occurred{error.reason ? `: ${error.reason}` : ""}
            <br />
            <br />
            Click to retry the transaction
        </>
    );
}

/**
 * When the article unlock is confirmed
 * @param already
 * @param success
 * @constructor
 */
export function UnlockConfirmation({
    already,
    success,
}: {
    already?: PaywallUnlockUiState["already"];
    success: PaywallUnlockUiState["success"];
}) {
    const current = already || success;
    const redirect = usePaywallRedirection();

    useEffect(() => {
        if (!current?.redirectUrl) return;

        // Do a redirect in 5sec
        const timeout = setTimeout(
            () => redirect({ redirectUrl: current.redirectUrl }),
            5_000
        );
        return () => {
            clearTimeout(timeout);
        };
    }, [redirect, current?.redirectUrl]);

    if (!current) {
        return null;
    }

    return (
        <>
            {already && "You have already purchased this article"}
            {success && "The transaction was sent with success!"}
            <br />
            Click to read the article
            <br />
            You will be redirected in 5sec
        </>
    );
}
