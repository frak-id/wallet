import { Link } from "@tanstack/react-router";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import styles from "./index.module.css";

export function DemoModeBadge() {
    const isDemoMode = useIsDemoMode();

    if (!isDemoMode) {
        return null;
    }

    return (
        <Link
            to="/settings"
            className={styles.demoModeBadge}
            title="Demo mode is active. Click to manage settings."
        >
            demo
        </Link>
    );
}
