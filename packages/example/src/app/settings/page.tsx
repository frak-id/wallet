"use client";

import { Square, SquareCheck } from "lucide-react";
import useLocalStorageState from "use-local-storage-state";
import styles from "./page.module.css";

export default function SettingsPage() {
    return (
        <div>
            <h1>Settings</h1>
            <br />
            <ConvertToEuroToggle />
        </div>
    );
}

function ConvertToEuroToggle() {
    const [isEnabled, toggle] = useLocalStorageState("amount-in-euro", {
        defaultValue: true,
    });
    return (
        <button type={"button"} onClick={() => toggle(!isEnabled)}>
            <span className={styles.row}>
                {isEnabled ? <SquareCheck /> : <Square />}
                Convert to Euro
            </span>
        </button>
    );
}
