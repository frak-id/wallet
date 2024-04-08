"use client";

import { postAuthRedirectAtom } from "@/module/authentication/atoms/redirection";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import { hasPaywallContextAtom } from "@/module/paywall/atoms/paywall";
import { useAtom } from "jotai";
import { useAtomValue } from "jotai/index";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    useTransition,
} from "react";
import styles from "./index.module.css";

export function Register() {
    const hasPaywallContext = useAtomValue(hasPaywallContextAtom);
    const router = useRouter();
    const [, startTransition] = useTransition();
    const { register, error, isRegisterInProgress } = useRegister();
    const [disabled, setDisabled] = useState(false);

    /**
     * Get the redirectUrl from the URL and set it in storage if needed
     */
    const { get: getSearchParam } = useSearchParams();
    const [redirectUrl, setRedirectUrl] = useAtom(postAuthRedirectAtom);
    useEffect(() => {
        const redirectUrl = getSearchParam("redirectUrl");
        if (redirectUrl) {
            setRedirectUrl(redirectUrl);
        }
    }, [getSearchParam, setRedirectUrl]);

    /**
     * Boolean used to know if the error is about a previously used authenticator
     */
    const isPreviouslyUsedAuthenticatorError = useMemo(
        () =>
            !!error &&
            "code" in error &&
            error.code === "ERROR_AUTHENTICATOR_PREVIOUSLY_REGISTERED",
        [error]
    );

    /**
     * Get the message that will displayed inside the button
     */
    const message = useMemo(() => {
        if (isPreviouslyUsedAuthenticatorError) {
            return (
                <>
                    You already have a NEXUS account on your device
                    <br />
                    <br />
                    Redirecting to the login page
                    <span className={"dotsLoading"}>...</span>
                </>
            );
        }
        if (error) {
            return <>Error during registration, please try again</>;
        }
        if (isRegisterInProgress) {
            return (
                <>
                    NEXUS Account creation in progress
                    <br />
                    <br />
                    Waiting for your biometry validation
                    <span className={"dotsLoading"}>...</span>
                </>
            );
        }
        return (
            <>
                Create your <strong>NEXUS</strong>
                <sup>*</sup> in a second with biometry
            </>
        );
    }, [isPreviouslyUsedAuthenticatorError, error, isRegisterInProgress]);

    const triggerAction = useCallback(async () => {
        setDisabled(true);
        await register();
        startTransition(() => {
            if (redirectUrl) {
                setRedirectUrl(null);
                window.location.href = decodeURIComponent(redirectUrl);
                return;
            }

            router.push(hasPaywallContext ? "/unlock" : "/wallet");
        });
        setDisabled(false);
    }, [redirectUrl, setRedirectUrl, router, register, hasPaywallContext]);

    useEffect(() => {
        if (!error) return;

        setDisabled(false);
    }, [error]);

    useEffect(() => {
        if (!isPreviouslyUsedAuthenticatorError) return;

        setTimeout(() => {
            router.push("/login");
        }, 3000);
    }, [isPreviouslyUsedAuthenticatorError, router]);

    return (
        <Grid
            className={styles.register__grid}
            footer={
                <>
                    <Link href={"/login"} title="Login">
                        Use an existing NEXUS
                    </Link>
                    <Notice>
                        <sup>*</sup>encrypted digital account where you can find
                        all the content you own, your consumption data and the
                        rewards you earn
                    </Notice>
                </>
            }
        >
            <AuthFingerprint
                action={triggerAction}
                disabled={disabled || isPreviouslyUsedAuthenticatorError}
            >
                {message}
            </AuthFingerprint>
        </Grid>
    );
}
