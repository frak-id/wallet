import { Badge } from "@frak-labs/design-system/components/Badge";
import { Text } from "@frak-labs/design-system/components/Text";
import type { PropsWithChildren } from "react";
import * as styles from "./index.css";

type PropsNotice = {
    className?: string;
};

export function Notice({
    children,
    className = "",
}: PropsWithChildren<PropsNotice>) {
    return (
        <Badge variant="info" className={`${styles.notice} ${className}`}>
            <Text as="span" variant="caption">
                {children}
            </Text>
        </Badge>
    );
}
