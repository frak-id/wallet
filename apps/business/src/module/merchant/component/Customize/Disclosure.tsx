import { ChevronDownIcon, ChevronUpIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import * as styles from "./customize.css";

export function AdvancedDisclosure({
    label,
    isOpen,
    onToggle,
    children,
}: {
    label: string;
    isOpen: boolean;
    onToggle: () => void;
    children: ReactNode;
}) {
    return (
        <div>
            <button
                type="button"
                className={styles.advancedToggle}
                onClick={onToggle}
                aria-expanded={isOpen}
            >
                {isOpen ? (
                    <ChevronUpIcon width={16} height={16} />
                ) : (
                    <ChevronDownIcon width={16} height={16} />
                )}
                {label}
            </button>
            {isOpen && <div className={styles.advancedBody}>{children}</div>}
        </div>
    );
}
