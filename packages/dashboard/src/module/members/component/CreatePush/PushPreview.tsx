import Image from "next/image";
import styles from "./PushPreview.module.css";
import iPhone from "./assets/iPhone.png";

export function PushPreview({
    title,
    text,
}: { title?: string; text?: string }) {
    return (
        <div className={styles.pushPreview}>
            <Image src={iPhone} alt={"iPhone"} />
            <div className={styles.pushPreview__notificationWrapper}>
                <div className={styles.pushPreview__notification}>
                    <p className={styles.pushPreview__title}>{title}</p>
                    <pre className={styles.pushPreview__text}>{text}</pre>
                    <p className={styles.pushPreview__date}>maintenant</p>
                </div>
            </div>
        </div>
    );
}
