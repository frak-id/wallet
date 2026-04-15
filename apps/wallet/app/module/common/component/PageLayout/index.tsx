import type { ReactNode } from "react";
import * as styles from "./index.css";

type PageLayoutProps = {
    children: ReactNode;
    /** Bottom-pinned footer content (buttons, actions) */
    footer?: ReactNode;
};

export function PageLayout({ children, footer }: PageLayoutProps) {
    return (
        <div className={styles.container}>
            <div className={styles.content}>{children}</div>
            {footer && <div className={styles.footer}>{footer}</div>}
        </div>
    );
}
