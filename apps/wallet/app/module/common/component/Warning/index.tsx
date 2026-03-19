import { Badge } from "@frak-labs/design-system/components/Badge";
import { Text } from "@frak-labs/design-system/components/Text";
import type { PropsWithChildren, ReactNode } from "react";
import * as styles from "./index.css";

export function Warning({
    text,
    className,
    children,
}: PropsWithChildren<{ text: string | ReactNode; className?: string }>) {
    return (
        <Badge variant="warning" className={`${styles.warning} ${className}`}>
            <Text as="span" className={styles.warningText}>
                &#9888; {text}
            </Text>
            {children}
        </Badge>
    );
}
