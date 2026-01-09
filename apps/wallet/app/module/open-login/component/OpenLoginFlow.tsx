import { Button } from "@frak-labs/ui/component/Button";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { HandleErrors, sessionStore } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
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

type RedirectState = "idle" | "redirecting" | "complete";

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

    const [error, setError] = useState<Error | null>(null);
    const [redirectState, setRedirectState] = useState<RedirectState>("idle");
    const hasAttemptedRedirect = useRef(false);
    const session = sessionStore((state) => state.session);

    useEffect(() => {
        hasAttemptedRedirect.current = false;
        setRedirectState("idle");
    }, [returnUrl, productId, state]);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (
                document.visibilityState === "visible" &&
                session &&
                redirectState !== "redirecting"
            ) {
                hasAttemptedRedirect.current = false;
                setRedirectState("idle");
            }
        };
        document.addEventListener("visibilitychange", handleVisibilityChange);
        return () =>
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange
            );
    }, [session, redirectState]);

    const handleLoginSuccess = useCallback(async () => {
        if (hasAttemptedRedirect.current) {
            return;
        }
        hasAttemptedRedirect.current = true;
        setRedirectState("redirecting");
        try {
            await executeRedirect({ returnUrl, productId, state });
            setRedirectState("complete");
            setTimeout(() => {
                navigate({ to: "/" });
            }, 500);
        } catch (err) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setRedirectState("idle");
        }
    }, [executeRedirect, returnUrl, productId, state, navigate]);

    useEffect(() => {
        if (session && !hasAttemptedRedirect.current) {
            handleLoginSuccess();
        }
    }, [session, handleLoginSuccess]);

    if (redirectState === "complete") {
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

    if (redirectState === "redirecting" || isRedirecting) {
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

    const displayError = error ?? redirectError;

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
                onError={setError}
                className={styles.openLogin__authActions}
            />

            {displayError && <HandleErrors error={displayError} />}
        </Grid>
    );
}
