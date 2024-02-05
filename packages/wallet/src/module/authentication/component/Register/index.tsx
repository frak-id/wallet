"use client";

import { useRegister } from "@/module/authentication/hook/useRegister";
import { Input } from "@/module/common/component/Input";
import { Fingerprint } from "lucide-react";
import type { FormEvent } from "react";
import styles from "./index.module.css";

export function TestRegister() {
    const { username, setUsername, register } = useRegister();

    /**
     * Startup the sign up process once the form is submitted
     * @param event
     */
    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        register();
    };

    return (
        <div className={styles.main}>
            <div className={styles.inner}>
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
                            onChangeValue={(value) =>
                                value && setUsername(value)
                            }
                        />
                    </p>
                    <p>
                        <button type={"submit"} className={styles.button}>
                            <Fingerprint size={48} />
                        </button>
                    </p>
                </form>
            </div>
        </div>
    );
}
