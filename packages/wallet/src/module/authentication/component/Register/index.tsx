"use client";

import { AccountName } from "@/module/authentication/component/AccountName";
import { AuthFingerprint } from "@/module/authentication/component/AuthFingerprint";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import { usePaywall } from "@/module/paywall/provider";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function Register() {
    const { context } = usePaywall();
    const router = useRouter();
    const [, startTransition] = useTransition();
    const {
        username,
        setUsername,
        register,
        error,
        isRegisterInProgress,
        isAirdroppingFrk,
    } = useRegister();
    const [disabled, setDisabled] = useState(false);
    const [showAccountName, setShowAccountName] = useState(false);

    function getMessages() {
        if (error) {
            return <>Error during registration, please try again</>;
        }
        if (isAirdroppingFrk) {
            return (
                <>
                    NEXUS Account creation in progress
                    <br />
                    <br />
                    Offering you a few frak
                    <span className={"dotsLoading"}>...</span>
                </>
            );
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
        if (username) {
            return (
                <>
                    Create your <strong>NEXUS</strong>
                    <sup>*</sup> in a second with biometry
                    <br />
                    <br />
                    The wallet name will be <strong>{username}</strong>
                </>
            );
        }
        return (
            <>
                Create your <strong>NEXUS</strong>
                <sup>*</sup> in a second with biometry
            </>
        );
    }

    async function triggerAction() {
        setDisabled(true);
        await register();
        startTransition(() => {
            router.push(context ? "/unlock" : "/wallet");
        });
        setDisabled(false);
    }

    useEffect(() => {
        if (error) {
            setDisabled(false);
        }
    }, [error]);

    return (
        <Grid
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
                    {showAccountName && (
                        <Notice>
                            <sup>**</sup>this name will enable you to retrieve
                            your Nexus easily
                        </Notice>
                    )}
                </>
            }
        >
            <AuthFingerprint action={triggerAction} disabled={disabled}>
                {getMessages()}
            </AuthFingerprint>

            <AccountName
                setUsername={setUsername}
                setShowAccountName={setShowAccountName}
                disabled={disabled}
            />
        </Grid>
    );
}
