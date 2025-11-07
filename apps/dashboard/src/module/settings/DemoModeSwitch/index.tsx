"use client";

import { useDemoMode } from "@/module/common/atoms/demoMode";
import { Switch } from "@/module/forms/Switch";
import styles from "./index.module.css";

export function DemoModeSwitch() {
    const { isDemoMode, setDemoMode } = useDemoMode();

    return (
        <div className={styles.demoModeSwitch}>
            <div className={styles.demoModeSwitch__content}>
                <div className={styles.demoModeSwitch__header}>
                    <label
                        htmlFor="demo-mode-switch"
                        className={styles.demoModeSwitch__label}
                    >
                        Enable Demo Mode
                    </label>
                    <Switch
                        id="demo-mode-switch"
                        checked={isDemoMode}
                        onCheckedChange={setDemoMode}
                    />
                </div>
                <p className={styles.demoModeSwitch__description}>
                    When enabled, all data will be replaced with mock data for
                    demonstration purposes. This is useful for presentations and
                    testing without affecting real data.
                </p>
                {isDemoMode && (
                    <p className={styles.demoModeSwitch__warning}>
                        Demo mode is currently active. All operations will be
                        simulated locally.
                    </p>
                )}
            </div>
        </div>
    );
}
