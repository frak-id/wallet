"use client";

import styles from "@/module/authentication/component/LoginItem/index.module.css";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

export function RecoverAccount() {
    const { login } = useLogin();

    const router = useRouter();
    const [, startTransition] = useTransition();

    return (
        <button
            type={"button"}
            onClick={async () => {
                await login({});
                startTransition(() => {
                    router.push("/");
                });
            }}
        >
            <span>Recover</span>
            <span>
                <Fingerprint size={36} className={styles.loginItem__icon} />
            </span>
        </button>
    );
}
