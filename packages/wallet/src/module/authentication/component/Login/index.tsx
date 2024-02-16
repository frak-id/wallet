"use client";

import { AccordionLogin } from "@/module/authentication/component/AccordionLogin";
import { LoginList } from "@/module/authentication/component/LoginList";
import { AuthFingerprint } from "@/module/authentication/component/Recover";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { usePaywall } from "@/module/paywall/provider";
import { HardDrive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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

    async function triggerAction() {
        await login({});
        startTransition(() => {
            router.push(context ? "/unlock" : "/wallet");
        });
    }

    return (
        <>
            <Back href={"/register"}>Account creation</Back>
            <Grid>
                <AuthFingerprint action={triggerAction}>
                    Recover your <strong>NEXUS</strong>
                </AuthFingerprint>

                <AccordionLogin
                    trigger={
                        <>
                            <HardDrive /> Nexus used on this device
                        </>
                    }
                >
                    <LoginList />
                </AccordionLogin>
            </Grid>
        </>
    );
}
