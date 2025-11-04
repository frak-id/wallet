import type { ReactNode } from "react";
import { Title, type TitleProps } from "@/module/common/component/Title";
import styles from "./index.module.css";

type HeadProps = {
    title?: { content: string; size?: TitleProps["size"] };
    leftSection?: ReactNode;
    rightSection?: ReactNode;
};

export function Head({ title, leftSection, rightSection }: HeadProps) {
    const { content, size } = title ?? {};
    return (
        <div className={styles.head}>
            <div className={styles.head__left}>
                {title && <Title size={size ?? "medium"}>{content}</Title>}
                {leftSection}
            </div>
            {rightSection && <div>{rightSection}</div>}
        </div>
    );
}
