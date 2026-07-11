import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "./or-divider.css";

/**
 * Labeled horizontal divider ("— or —"). The design system has no Separator
 * primitive, so this is the single place that hand-rolls the rule.
 */
export function OrDivider({ label }: { label: string }) {
    return (
        <div className={styles.container}>
            <span className={styles.line} />
            <Text variant="caption" color="tertiary">
                {label}
            </Text>
            <span className={styles.line} />
        </div>
    );
}
