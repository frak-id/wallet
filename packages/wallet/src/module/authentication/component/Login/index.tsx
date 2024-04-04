"use client";

import { LoginList } from "@/module/authentication/component/LoginList";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { usePaywall } from "@/module/paywall/provider";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import useLocalStorageState from "use-local-storage-state";
import styles from "./index.module.css";

/**
 * Login from previous authentication
 * TODO: Flow for account recovery will be pretty simlar, just not listing previous authentications, just inputting the username
 * @constructor
 */
export function Login() {
    const { login } = useLogin();
    const { context } = usePaywall();
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [disabled, setDisabled] = useState(false);
    const [redirectUrl, setRedirectUrl] = useLocalStorageState<string | null>(
        "redirectUrl",
        { defaultValue: null }
    );

    async function triggerAction() {
        setDisabled(true);
        await login({});
        startTransition(() => {
            if (redirectUrl) {
                setRedirectUrl(null);
                window.location.href = decodeURIComponent(redirectUrl);
                return;
            }

            router.push(context ? "/unlock" : "/wallet");
            setDisabled(false);
        });
    }

    return (
        <>
            <Back href={"/register"}>Account creation</Back>
            <Grid className={styles.login__grid} footer={<LoginList />}>
                <AuthFingerprint action={triggerAction} disabled={disabled}>
                    Recover your <strong>NEXUS</strong>
                </AuthFingerprint>
            </Grid>
        </>
    );
}
