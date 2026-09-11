import type { ReactNode } from "react";
import * as styles from "./DescriptionList.css";

type DescriptionListItem = {
    term: string;
    description: ReactNode;
};

type DescriptionListProps = {
    items: DescriptionListItem[];
};

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
