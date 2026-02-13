import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function PairingDropdown({
    children,
    className,
}: PropsWithChildren<{ className?: string }>) {
    return (
        <div
            className={`${styles.pairingDropdown}${className ? ` ${className}` : ""}`}
        >
            {children}
        </div>
    );
}
