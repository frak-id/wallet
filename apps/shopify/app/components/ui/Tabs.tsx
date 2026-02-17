import type { ReactNode } from "react";
import styles from "./Tabs.module.css";

interface Tab {
    id: string;
    content: string;
}

interface TabsProps {
    tabs: Tab[];
    selected: number;
    onSelect: (index: number) => void;
    children?: ReactNode;
}

export function Tabs({ tabs, selected, onSelect, children }: TabsProps) {
    return (
        <div>
            <div role="tablist" className={styles.tabList}>
                {tabs.map((tab, index) => (
                    <button
                        key={tab.id}
                        type="button"
                        role="tab"
                        aria-selected={selected === index}
                        onClick={() => onSelect(index)}
                        className={styles.tab}
                    >
                        {tab.content}
                    </button>
                ))}
            </div>
            {children && <div className={styles.content}>{children}</div>}
        </div>
    );
}
