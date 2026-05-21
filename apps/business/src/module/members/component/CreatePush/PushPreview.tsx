import clsx from "clsx";
import iPhone from "./assets/iPhone.png";
import * as styles from "./push-preview.css";

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
            <img src={iPhone} alt={"iPhone"} />
            <div className={styles.pushPreviewNotificationWrapper}>
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
        <div className={clsx(styles.pushPreviewNotification, className)}>
            {icon && (
                <span className={styles.pushPreviewIcon}>
                    <img src={icon} alt={""} width={20} height={20} />
                </span>
            )}
            <div>
                <p className={styles.pushPreviewTitle}>{title}</p>
                <pre className={styles.pushPreviewText}>{message}</pre>
                <p className={clsx(styles.pushPreviewDate, classNameDate)}>
                    now
                </p>
            </div>
        </div>
    );
}
