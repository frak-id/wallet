import glass from "./assets/notification-glass.webp";
import iconPlaceholder from "./assets/notification-icon-placeholder.webp";
import phone1x from "./assets/wallet-2x1.webp";
import phone2x from "./assets/wallet-2x2.webp";
import * as styles from "./push-preview.css";

type PushPreviewProps = {
    title?: string;
    message?: string;
    icon?: string;
};

/**
 * iPhone lock-screen mock with a live glass notification overlaid on the
 * exported wallpaper frame.
 */
export function PushPreview({ title, message, icon }: PushPreviewProps) {
    return (
        <div className={styles.phone}>
            <img
                src={phone1x}
                srcSet={`${phone1x} 1x, ${phone2x} 2x`}
                alt=""
                width={353}
                height={735}
                decoding="async"
                fetchPriority="low"
                className={styles.phoneImage}
            />
            <div
                className={styles.notification}
                style={{ backgroundImage: `url(${glass})` }}
            >
                <span className={styles.icon}>
                    <img
                        src={icon || iconPlaceholder}
                        alt=""
                        className={styles.iconImage}
                        width={31}
                        height={31}
                    />
                </span>
                <div className={styles.body}>
                    <div className={styles.text}>
                        <p className={styles.title}>{title}</p>
                        <p className={styles.message}>{message}</p>
                    </div>
                    <span className={styles.time}>now</span>
                </div>
            </div>
        </div>
    );
}
