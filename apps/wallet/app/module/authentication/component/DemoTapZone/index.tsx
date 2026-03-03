import { useDemoTap } from "@/module/authentication/hook/useDemoTap";
import styles from "./index.module.css";

export function DemoTapZone({
    navigate,
    to,
}: {
    navigate: (opts: { to: string }) => void;
    to?: string;
}) {
    const { onTap, enabled } = useDemoTap(navigate, to);

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
