"use client";
import { setSession } from "@/context/auth/actions/session";
import { useSiweAuthenticate } from "@frak-labs/nexus-sdk/react";
import { Button } from "@module/component/Button";
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
            <Button
                onClick={() =>
                    authenticate({
                        metadata: {
                            header: {
                                title: "Authentication",
                            },
                        },
                    })
                }
            >
                Connect to your Nexus
            </Button>
        </div>
    );
}
