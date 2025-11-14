import type { ComponentType } from "react";
import { BrowserWindow } from "./BrowserWindow";
import styles from "./ComponentCard.module.css";

type ComponentCardProps = {
    title: string;
    description: string;
    action: string;
    preview: ComponentType;
    showWallet?: boolean;
};

export function ComponentCard({
    title,
    description,
    action,
    preview: Preview,
    showWallet,
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
                {...(showWallet && { "show-wallet": "true" })}
            />
        </div>
    );
}
