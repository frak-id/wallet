import { Text } from "@frak-labs/design-system/components/Text";
import * as styles from "./index.css";

// iOS scroll-edge blur behind the toolbar; kept as its own component so its
// fade-in branch lives out of ExplorerDetail's body. A masked backdrop-filter
// band whose blur radius animates in (see toolbarBlur for why radius, not
// opacity).
export function ToolbarBlur({ visible }: { visible: boolean }) {
    return (
        <div
            aria-hidden="true"
            className={
                visible
                    ? `${styles.toolbarBlur} ${styles.toolbarBlurVisible}`
                    : styles.toolbarBlur
            }
        />
    );
}

// Merchant name mirrored into the fixed toolbar; kept as its own component so
// the reveal branch lives out of ExplorerDetail's body.
export function ToolbarTitle({
    name,
    visible,
}: {
    name: string;
    visible: boolean;
}) {
    return (
        <span
            aria-hidden="true"
            className={
                visible
                    ? `${styles.toolbarTitle} ${styles.toolbarTitleVisible}`
                    : styles.toolbarTitle
            }
        >
            <Text
                as="span"
                variant="body"
                weight="semiBold"
                color="primary"
                className={styles.toolbarTitleText}
            >
                {name}
            </Text>
        </span>
    );
}
