import { useNavigate } from "@tanstack/react-router";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import styles from "./index.module.css";

export function DemoModeBadge() {
    const isDemoMode = useIsDemoMode();
    const navigate = useNavigate();

    if (!isDemoMode) {
        return null;
    }

    return (
        <button
            type="button"
            className={styles.demoModeBadge}
            onClick={() => navigate({ to: "/settings" })}
            title="Demo mode is active. Click to manage settings."
        >
            demo
        </button>
    );
}
