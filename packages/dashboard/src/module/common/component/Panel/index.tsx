import { Title } from "@/module/common/component/Title";
import { BadgeCheck } from "lucide-react";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type PanelProps = {
    title?: string;
    className?: string;
};

export function Panel({
    title,
    className = "",
    children,
}: PropsWithChildren<PanelProps>) {
    return (
        <div className={`${styles.panel} ${className}`}>
            {title && (
                <Title
                    icon={<BadgeCheck color={"#0DDB84"} />}
                    size={"small"}
                    className={styles.panel__title}
                >
                    {title}
                </Title>
            )}
            {children}
        </div>
    );
}
