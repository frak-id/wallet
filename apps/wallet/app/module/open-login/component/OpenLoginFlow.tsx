import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { HandleErrors, sessionStore } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useReducer } from "react";
import { Trans, useTranslation } from "react-i18next";
import type { Hex } from "viem";
import { AuthActions } from "@/module/authentication/component/AuthActions";
import { Grid } from "@/module/common/component/Grid";
import { useMobileLoginRedirect } from "../hook/useMobileLoginRedirect";
import styles from "./OpenLoginFlow.module.css";

type OpenLoginFlowProps = {
    returnUrl: string;
    productId: Hex;
    state?: string;
    productName?: string;
};

type FlowState = {
    status: "idle" | "redirecting" | "complete";
    error: Error | null;
    hasAttempted: boolean;
};

type FlowAction =
    | { type: "RESET" }
    | { type: "START_REDIRECT" }
    | { type: "REDIRECT_SUCCESS" }
    | { type: "REDIRECT_ERROR"; error: Error }
    | { type: "SET_ERROR"; error: Error | null };

function flowReducer(state: FlowState, action: FlowAction): FlowState {
    switch (action.type) {
        case "RESET":
            return { status: "idle", error: null, hasAttempted: false };
        case "START_REDIRECT":
            return { ...state, status: "redirecting", hasAttempted: true };
        case "REDIRECT_SUCCESS":
            return { ...state, status: "complete", error: null };
        case "REDIRECT_ERROR":
            return { status: "idle", error: action.error, hasAttempted: true };
        case "SET_ERROR":
            return { ...state, error: action.error };
        default:
            return state;
    }
}

const initialState: FlowState = {
    status: "idle",
    error: null,
    hasAttempted: false,
};

export function OpenLoginFlow({
    returnUrl,
    productId,
    state,
    productName,
}: OpenLoginFlowProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const {
        executeRedirect,
        retryRedirect,
        isRedirecting,
        error: redirectError,
    } = useMobileLoginRedirect();

    const [flowState, dispatch] = useReducer(flowReducer, initialState);
    const session = sessionStore((s) => s.session);

    // Reset when params change
    useEffect(() => {
        dispatch({ type: "RESET" });
    }, [returnUrl, productId, state]);

    // Reset on visibility change (user returns to page)
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (
                document.visibilityState === "visible" &&
                session &&
                flowState.status !== "redirecting"
            ) {
                dispatch({ type: "RESET" });
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () =>
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
    }, [session, flowState.status]);

    const handleLoginSuccess = useCallback(async () => {
        if (flowState.hasAttempted) return;

        dispatch({ type: "START_REDIRECT" });
        try {
            await executeRedirect({ returnUrl, productId, state });
            dispatch({ type: "REDIRECT_SUCCESS" });
            setTimeout(() => navigate({ to: "/" }), 500);
        } catch (err) {
            dispatch({
                type: "REDIRECT_ERROR",
                error: err instanceof Error ? err : new Error(String(err)),
            });
        }
    }, [
        flowState.hasAttempted,
        executeRedirect,
        returnUrl,
        productId,
        state,
        navigate,
    ]);

    // Auto-redirect when session exists
    useEffect(() => {
        if (session && !flowState.hasAttempted) {
            handleLoginSuccess();
        }
    }, [session, flowState.hasAttempted, handleLoginSuccess]);

    if (flowState.status === "complete") {
        return (
            <Grid className={styles.openLogin__grid}>
                <h2 className={styles.openLogin__title}>
                    {t("wallet.openLogin.complete.title")}
                </h2>
                <p className={styles.openLogin__subtitle}>
                    <Trans
                        i18nKey="wallet.openLogin.complete.message"
                        values={{ productName: productName ?? "the app" }}
                    />
                </p>
                <Button variant="primary" onClick={retryRedirect}>
                    {t("wallet.openLogin.complete.backToBrowser")}
                </Button>
            </Grid>
        );
    }

    if (flowState.status === "redirecting" || isRedirecting) {
        return (
            <Grid className={styles.openLogin__grid}>
                <Spinner />
                <p className={styles.openLogin__redirecting}>
                    <Trans
                        i18nKey="wallet.openLogin.redirecting"
                        values={{ productName: productName ?? "the app" }}
                    />
                    <span className="dotsLoading">...</span>
                </p>
            </Grid>
        );
    }

    const displayError = flowState.error ?? redirectError;

    return (
        <Grid className={styles.openLogin__grid}>
            <h2 className={styles.openLogin__title}>
                {t("wallet.openLogin.title")}
            </h2>
            {productName && (
                <p className={styles.openLogin__subtitle}>
                    <Trans
                        i18nKey="wallet.openLogin.subtitle"
                        values={{ productName }}
                    />
                </p>
            )}

            <AuthActions
                onSuccess={handleLoginSuccess}
                onError={(err) => dispatch({ type: "SET_ERROR", error: err })}
                className={styles.openLogin__authActions}
            />

            {displayError && <HandleErrors error={displayError} />}
        </Grid>
    );
}
