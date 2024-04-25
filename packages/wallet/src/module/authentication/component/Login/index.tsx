"use client";

import { postAuthRedirectAtom } from "@/module/authentication/atoms/redirection";
import { LoginList } from "@/module/authentication/component/LoginList";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { hasPaywallContextAtom } from "@/module/paywall/atoms/paywall";
import { useAtom, useAtomValue } from "jotai/index";
import { CloudUpload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import styles from "./index.module.css";

/**
 * Login from previous authentication
 * TODO: Flow for account recovery will be pretty simlar, just not listing previous authentications, just inputting the username
 * @constructor
 */
export function Login() {
    const { login } = useLogin();
    const hasPaywallContext = useAtomValue(hasPaywallContextAtom);
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [disabled, setDisabled] = useState(false);
    const [redirectUrl, setRedirectUrl] = useAtom(postAuthRedirectAtom);

    const triggerAction = useCallback(async () => {
        setDisabled(true);
        await login({});
        startTransition(() => {
            if (redirectUrl) {
                setRedirectUrl(null);
                window.location.href = decodeURIComponent(redirectUrl);
                return;
            }

            router.push(hasPaywallContext ? "/unlock" : "/wallet");
            setDisabled(false);
        });
    }, [hasPaywallContext, redirectUrl, setRedirectUrl, router, login]);

    return (
        <>
            <Back href={"/register"}>Account creation</Back>
            <Grid
                className={styles.login__grid}
                footer={
                    <>
                        <Link href={"/recovery"} className={styles.login__link}>
                            <CloudUpload /> Recover wallet from file
                        </Link>
                        <LoginList />
                    </>
                }
            >
                <AuthFingerprint action={triggerAction} disabled={disabled}>
                    Recover your <strong>NEXUS</strong>
                </AuthFingerprint>
            </Grid>
        </>
    );
}
