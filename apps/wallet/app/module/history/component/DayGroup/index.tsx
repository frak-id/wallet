import type { HistoryGroup } from "@frak-labs/wallet-shared";
import type { ReactNode } from "react";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import styles from "./index.module.css";

/**
 * Component for an history day group
 * @constructor
 */
export function HistoryDayGroup<T>({
    group,
    innerComponent,
}: {
    group: HistoryGroup<T>;
    innerComponent: (item: T) => ReactNode;
}) {
    console.log(group);
    return Object.entries(group).map(([day, items]) => (
        <div key={day} className={styles.historyGroup}>
            <Title>{day}</Title>
            <Panel size={"small"}>
                {items.map((item, index) => (
                    <div
                        key={`${day}-${index}`}
                        className={styles.historyGroup__item}
                    >
                        {innerComponent(item)}
                    </div>
                ))}
            </Panel>
        </div>
    ));
}
