import { cx } from "class-variance-authority";
import Image from "next/image";
import styles from "./PushPreview.module.css";
import iPhone from "./assets/iPhone.png";

type PushPreviewProps = {
    title?: string;
    message?: string;
    icon?: string;
    className?: string;
    classNameDate?: string;
};

export function PushPreview(props: PushPreviewProps) {
    return (
        <div className={styles.pushPreview}>
            <Image src={iPhone} alt={"iPhone"} />
            <div className={styles.pushPreview__notificationWrapper}>
                <PushPreviewNotification {...props} />
            </div>
        </div>
    );
}

export function PushPreviewNotification({
    title,
    message,
    icon,
    className,
    classNameDate,
}: PushPreviewProps) {
    return (
        <div className={cx(styles.pushPreview__notification, className)}>
            {icon && (
                <span className={styles.pushPreview__icon}>
                    <img src={icon} alt={""} width={20} height={20} />
                </span>
            )}
            <div>
                <p className={styles.pushPreview__title}>{title}</p>
                <pre className={styles.pushPreview__text}>{message}</pre>
                <p className={cx(styles.pushPreview__date, classNameDate)}>
                    now
                </p>
            </div>
        </div>
    );
}
