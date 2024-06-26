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
                // If not a success response, exit
                if (data.key !== "success") {
                    return;
                }

                // Register the session
                await setSession({
                    siwe: data.message,
                    signature: data.signature,
                });

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
                        context: "Test authentication",
                    })
                }
            >
                Connect to your Nexus
            </ButtonRipple>
        </div>
    );
}
