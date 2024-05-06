"use client";

import {setUserReferred} from "@/context/referral/action/userReferred";
import {setUserReferredOnContent} from "@/context/referral/action/userReferredOnContent";
import {postAuthRedirectAtom} from "@/module/authentication/atoms/redirection";
import {LoginList} from "@/module/authentication/component/LoginList";
import {useLogin} from "@/module/authentication/hook/useLogin";
import {AuthFingerprint} from "@/module/common/component/AuthFingerprint";
import {Back} from "@/module/common/component/Back";
import {Grid} from "@/module/common/component/Grid";
import {referralHistoryAtom} from "@/module/listener/atoms/referralHistory";
import {hasPaywallContextAtom} from "@/module/paywall/atoms/paywall";
import type {WebAuthNWallet} from "@/types/WebAuthN";
import {useAtom, useAtomValue} from "jotai/index";
import {CloudUpload} from "lucide-react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useCallback, useState, useTransition} from "react";
import type {Hex} from "viem";
import styles from "./index.module.css";

/**
 * Login from previous authentication
 * TODO: Flow for account recovery will be pretty simlar, just not listing previous authentications, just inputting the username
 * @constructor
 */
export function Login() {
    const {login} = useLogin();
    const hasPaywallContext = useAtomValue(hasPaywallContextAtom);
    const router = useRouter();
    const [, startTransition] = useTransition();
    const [disabled, setDisabled] = useState(false);
    const [redirectUrl, setRedirectUrl] = useAtom(postAuthRedirectAtom);

    /**
     * Referral history atom
     */
    const [referralHistory, setReferralHistory] = useAtom(referralHistoryAtom);

    const triggerRegister = useCallback(async () => {
        const {wallet} = await login({});
        return wallet;
    }, [login]);

    const triggerReferral = useCallback(
        async (wallet: WebAuthNWallet) => {
            if (!referralHistory) return;

            // Set the user referred
            await setUserReferred({
                user: wallet.address,
                referrer: referralHistory.lastReferrer,
            });

            // Set the user referred on each content
            for (const contentId of Object.keys(referralHistory.contents)) {
                const walletAddress =
                    referralHistory.contents[contentId as Hex];
                await setUserReferredOnContent({
                    user: wallet.address,
                    referrer: walletAddress,
                    contentId: contentId as Hex,
                });
            }

            // Reset referral history
            setReferralHistory({
                contents: {},
                lastReferrer: "0x00",
            });
        },
        [referralHistory, setReferralHistory]
    );

    return (
        <>
            <Back href={"/register"}>Account creation</Back>
            <Grid
                className={styles.login__grid}
                footer={
                    <>
                        <Link href={"/recovery"} className={styles.login__link}>
                            <CloudUpload/> Recover wallet from file
                        </Link>
                        <LoginList/>
                    </>
                }
            >
                <AuthFingerprint
                    action={async () => {
                        setDisabled(true);
                        const wallet = await triggerRegister();
                        await triggerReferral(wallet);
                        startTransition(() => {
                            if (redirectUrl) {
                                setRedirectUrl(null);
                                window.location.href =
                                    decodeURIComponent(redirectUrl);
                                return;
                            }

                            router.push(
                                hasPaywallContext ? "/unlock" : "/wallet"
                            );
                            setDisabled(false);
                        });
                    }}
                    disabled={disabled}
                >
                    Recover your <strong>NEXUS</strong>
                </AuthFingerprint>
            </Grid>
        </>
    );
}
