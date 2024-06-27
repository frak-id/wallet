"use client";
import { setSession } from "@/context/auth/actions/session";
import { useSiweAuthenticate } from "@frak-labs/nexus-sdk/react";
import { ButtonRipple } from "@frak-labs/nexus-wallet/src/module/common/component/ButtonRipple";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./index.module.css";

export function Login() {
    const router = useRouter();
    const [, startTransition] = useTransition();

    const { mutate: authenticate } = useSiweAuthenticate({
        mutations: {
            onSuccess: async (data) => {
                // Register the session
                await setSession(data);

                // Redirect to /dashboard
                startTransition(() => {
                    router.push("/dashboard");
                });
            },
        },
    });

    return (
        <div className={styles.notConnected}>
            <ButtonRipple
                onClick={() =>
                    authenticate({
                        context: "Authentication",
                    })
                }
            >
                Connect to your Nexus
            </ButtonRipple>
        </div>
    );
}
