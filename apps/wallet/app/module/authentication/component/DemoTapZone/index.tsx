import { useDemoTap } from "@/module/authentication/hook/useDemoTap";
import styles from "./index.module.css";

export function DemoTapZone({
    navigate,
}: {
    navigate: (opts: { to: string }) => void;
}) {
    const { onTap, enabled } = useDemoTap(navigate);

    if (!enabled) return null;

    return (
        <div
            role="presentation"
            onClick={onTap}
            onKeyDown={undefined}
            className={styles.demoTap}
        />
    );
}
