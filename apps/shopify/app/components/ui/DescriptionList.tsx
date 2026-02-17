import type { ReactNode } from "react";
import styles from "./DescriptionList.module.css";

interface DescriptionListItem {
    term: string;
    description: ReactNode;
}

interface DescriptionListProps {
    items: DescriptionListItem[];
}

export function DescriptionList({ items }: DescriptionListProps) {
    return (
        <dl className={styles.descriptionList}>
            {items.map((item) => (
                <div key={item.term}>
                    <dt className={styles.term}>{item.term}</dt>
                    <dd className={styles.description}>{item.description}</dd>
                </div>
            ))}
        </dl>
    );
}
