"use client";

import { useRegister } from "@/module/authentication/hook/useRegister";
import { Input } from "@/module/common/component/Input";
import { Fingerprint } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { FormEvent } from "react";
import styles from "./index.module.css";

export function Register() {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const { username, setUsername, register } = useRegister();

    /**
     * Startup the sign up process once the form is submitted
     * @param event
     */
    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        await register();
        startTransition(() => {
            router.push("/");
        });
    };

    return (
        <form onSubmit={onSubmit}>
            <p className={styles.input}>
                <label htmlFor="username">Account name</label>
                <Input
                    type={"text"}
                    name={"username"}
                    id={"username"}
                    aria-label="Your username"
                    placeholder="Enter your username"
                    value={username}
                    onChangeValue={(value) => value && setUsername(value)}
                />
            </p>
            <p>
                <button type={"submit"} className={styles.button}>
                    <Fingerprint size={48} />
                </button>
            </p>
        </form>
    );
}
