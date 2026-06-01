import { Text } from "@frak-labs/design-system/components/Text";
import { InfoIcon } from "@frak-labs/design-system/icons";
import type { ReactNode } from "react";
import * as styles from "./infoBanner.css";

/**
 * Light-blue informational bar used across the campaign wizard steps: a blue
 * info icon followed by the message text.
 */
export function InfoBanner({ children }: { children: ReactNode }) {
    return (
        <div className={styles.banner}>
            <InfoIcon width={20} height={20} className={styles.icon} />
            <Text variant="bodySmall" color="primary">
                {children}
            </Text>
        </div>
    );
}
