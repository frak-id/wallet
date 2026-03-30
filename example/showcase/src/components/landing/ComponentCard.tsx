import type { ComponentType } from "react";
import { BrowserWindow } from "./BrowserWindow";
import styles from "./ComponentCard.module.css";

type ComponentCardProps = {
    title: string;
    description: string;
    action: string;
    preview: ComponentType;
    clickAction?: "embedded-wallet" | "share-modal";
};

export function ComponentCard({
    title,
    description,
    action,
    preview: Preview,
    clickAction,
}: ComponentCardProps) {
    return (
        <div className={styles.card}>
            <BrowserWindow>
                <Preview />
            </BrowserWindow>
            <h3>{title}</h3>
            <p>{description}</p>
            {/* @ts-expect-error - Frak SDK web component */}
            <frak-button-share
                text={action}
                classname="card__button"
                {...(clickAction && { "click-action": clickAction })}
            />
        </div>
    );
}
