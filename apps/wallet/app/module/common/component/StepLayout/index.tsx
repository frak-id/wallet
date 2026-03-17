import { Box } from "@frak-labs/ui/component/Box";
import type { ReactNode } from "react";
import styles from "./index.module.css";

type StepLayoutProps = {
    icon: ReactNode;
    title: ReactNode;
    description: ReactNode;
    footer: ReactNode;
    children?: ReactNode;
};

export function StepLayout({
    icon,
    title,
    description,
    footer,
    children,
}: StepLayoutProps) {
    return (
        <div className={styles.stepLayout}>
            <Box gap="l" padding="none" className={styles.stepLayout__content}>
                <div className={styles.stepLayout__icon}>{icon}</div>
                <h1 className={styles.stepLayout__title}>{title}</h1>
                <p className={styles.stepLayout__description}>{description}</p>
                {children}
            </Box>
            <div className={styles.stepLayout__footer}>{footer}</div>
        </div>
    );
}
