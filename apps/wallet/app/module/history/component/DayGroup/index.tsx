import { Box } from "@frak-labs/design-system/components/Box";
import { Stack } from "@frak-labs/design-system/components/Stack";
import type { HistoryGroup } from "@frak-labs/wallet-shared";
import type { ReactNode } from "react";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

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
    return Object.entries(group).map(([day, items]) => (
        <Box key={day} className={styles.historyGroup}>
            <Stack space="m">
                <Title>{day}</Title>
                <Panel size={"small"}>
                    <Stack space="xs">
                        {items.map((item, index) => (
                            <Box
                                key={`${day}-${index}`}
                                display="flex"
                                flexDirection="row"
                                justifyContent="space-between"
                                alignItems="center"
                                className={styles.historyGroupItem}
                            >
                                {innerComponent(item)}
                            </Box>
                        ))}
                    </Stack>
                </Panel>
            </Stack>
        </Box>
    ));
}
