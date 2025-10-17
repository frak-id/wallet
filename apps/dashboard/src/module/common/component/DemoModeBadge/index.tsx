"use client";

import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { useRouter } from "next/navigation";
import styles from "./index.module.css";

export function DemoModeBadge() {
    const isDemoMode = useIsDemoMode();
    const router = useRouter();

    if (!isDemoMode) {
        return null;
    }

    return (
        <button
            type="button"
            className={styles.demoModeBadge}
            onClick={() => router.push("/settings")}
            title="Demo mode is active. Click to manage settings."
        >
            demo
        </button>
    );
}
