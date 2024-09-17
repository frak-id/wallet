import { cx } from "class-variance-authority";
import Image from "next/image";
import styles from "./PushPreview.module.css";
import iPhone from "./assets/iPhone.png";

type PushPreviewProps = {
    title?: string;
    message?: string;
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
    className,
    classNameDate,
}: PushPreviewProps) {
    return (
        <div className={cx(styles.pushPreview__notification, className)}>
            <p className={styles.pushPreview__title}>{title}</p>
            <pre className={styles.pushPreview__text}>{message}</pre>
            <p className={cx(styles.pushPreview__date, classNameDate)}>
                maintenant
            </p>
        </div>
    );
}
