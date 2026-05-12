import { Box } from "@frak-labs/design-system/components/Box";
import type { ReactNode } from "react";
import * as styles from "./index.css";

type PageLayoutProps = {
    children: ReactNode;
    /** Optional back affordance rendered above the content (typically a `<Back />`) */
    back?: ReactNode;
    /** Bottom-pinned footer content (buttons, actions) */
    footer?: ReactNode;
};

export function PageLayout({ children, back, footer }: PageLayoutProps) {
    return (
        <div className={styles.container}>
            <div className={styles.content}>
                {back && <Box paddingLeft="m">{back}</Box>}
                {children}
            </div>
            {footer && <div className={styles.footer}>{footer}</div>}
        </div>
    );
}
