import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import * as styles from "./customize.css";

export type SegmentedTabsProps<T extends string> = {
    value: string;
    options: readonly T[];
    labelFor: (option: T) => string;
    onSelect: (option: T) => void;
    testId?: string;
};

/**
 * The segmented track this screen uses everywhere. A `value` matching no
 * option leaves every trigger inactive, which is how "custom" is rendered.
 */
export function SegmentedTabs<T extends string>({
    value,
    options,
    labelFor,
    onSelect,
    testId,
}: SegmentedTabsProps<T>) {
    return (
        <Tabs value={value} onValueChange={(next) => onSelect(next as T)}>
            <TabsList
                variant="segmented"
                fullWidth
                className={styles.segmentedTrack}
            >
                {options.map((option) => (
                    <TabsTrigger
                        key={option}
                        value={option}
                        variant="segmented"
                        fullWidth
                        data-testid={testId ? `${testId}-${option}` : undefined}
                    >
                        {labelFor(option)}
                    </TabsTrigger>
                ))}
            </TabsList>
        </Tabs>
    );
}
