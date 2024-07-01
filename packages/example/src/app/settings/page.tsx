"use client";

import { useSiweAuthenticate } from "@frak-labs/nexus-sdk/react";
import { Square, SquareCheck } from "lucide-react";
import useLocalStorageState from "use-local-storage-state";
import styles from "./page.module.css";

export default function SettingsPage() {
    return (
        <div>
            <h1>Settings</h1>
            <br />
            <ConvertToEuroToggle />
            <br />
            <br />
            <TestCrossDomainAuth />
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

function TestCrossDomainAuth() {
    const { mutate: authenticate } = useSiweAuthenticate({
        mutations: {
            onSuccess: (data, variables, context) => {
                console.log("Cross domain success", {
                    data,
                    variables,
                    context,
                });
            },
            onError: (error, variables, context) => {
                console.error("Cross domain error", {
                    error,
                    variables,
                    context,
                });
            },
        },
    });

    return (
        <button
            type={"button"}
            onClick={() => {
                authenticate({});
            }}
        >
            Test Cross Domain Auth
        </button>
    );
}
