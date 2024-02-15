"use client";

import { AccountName } from "@/module/authentication/component/AccountName";
import { AuthFingerprint } from "@/module/authentication/component/Recover";
import { useRegister } from "@/module/authentication/hook/useRegister";
import { Grid } from "@/module/common/component/Grid";
import { Notice } from "@/module/common/component/Notice";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function Register() {
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
                    Create your <strong>NEXUS</strong>* in a second with
                    biometry
                    <br />
                    <br />
                    The wallet name will be {username}
                </>
            );
        }
        return (
            <>
                Create your <strong>NEXUS</strong>* in a second with biometry
            </>
        );
    }

    async function triggerAction() {
        setDisabled(true);
        await register();
        startTransition(() => {
            router.push("/wallet");
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
                <Link href={"/login"} title="Login">
                    Use an existing NEXUS
                </Link>
            }
        >
            <AuthFingerprint action={triggerAction} disabled={disabled}>
                {getMessages()}
            </AuthFingerprint>

            <AccountName
                username={username}
                setUsername={setUsername}
                disabled={disabled}
            />

            <Notice>
                *encrypted digital account where you can find all the content
                you own, your consumption data and the rewards you earn
            </Notice>
        </Grid>
    );
}
