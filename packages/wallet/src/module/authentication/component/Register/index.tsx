"use client";

import { useRegister } from "@/module/authentication/hook/useRegister";
import styles from "./index.module.css";

export function TestRegister() {
    const { username } = useRegister();

    return (
        <div className={styles.main}>
            <div className={styles.inner}>
                <p>Test username {username}</p>
            </div>
        </div>
    );
}
