"use client";

import { LoginList } from "@/module/authentication/component/LoginList";
import { AuthFingerprint } from "@/module/authentication/component/Recover";
import { useLogin } from "@/module/authentication/hook/useLogin";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/module/common/component/Accordion";
import { Back } from "@/module/common/component/Back";
import { Grid } from "@/module/common/component/Grid";
import { HardDrive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./index.module.css";

/**
 * Login from previous authentication
 * TODO: Flow for account recovery will be pretty simlar, just not listing previous authentications, just inputting the username
 * @constructor
 */
export function Login() {
    const { login } = useLogin();
    const router = useRouter();
    const [, startTransition] = useTransition();

    async function triggerAction() {
        await login({});
        startTransition(() => {
            router.push("/wallet");
        });
    }

    return (
        <>
            <Back href={"/register"}>Account creation</Back>
            <Grid>
                <AuthFingerprint action={triggerAction}>
                    Recover your <strong>NEXUS</strong>
                </AuthFingerprint>

                <Accordion
                    type={"single"}
                    collapsible
                    className={styles.login__accordion}
                >
                    <AccordionItem value={"item-1"}>
                        <AccordionTrigger className={styles.login__trigger}>
                            <HardDrive /> Nexus used on this device
                        </AccordionTrigger>
                        <AccordionContent>
                            <LoginList />
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
            </Grid>
        </>
    );
}
