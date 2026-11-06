import * as styles from "./statusBar.css";

/** iOS status bar of the simulated phone (desktop frame only). */
export function StatusBar({
    tone,
    time,
}: {
    tone: "dark" | "light";
    time: string;
}) {
    return (
        <div className={styles.bar({ tone })} aria-hidden="true">
            <span className={styles.time}>{time}</span>
            <span className={styles.icons}>
                <svg width="19" height="12" viewBox="0 0 19 12">
                    <title>Signal</title>
                    <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.9" />
                    <rect x="5" y="5.2" width="3.2" height="6.8" rx="0.9" />
                    <rect x="10" y="2.6" width="3.2" height="9.4" rx="0.9" />
                    <rect x="15" y="0" width="3.2" height="12" rx="0.9" />
                </svg>
                <svg width="17" height="12" viewBox="0 0 17 12">
                    <title>Wi-Fi</title>
                    <path d="M8.5 2.3c2.4 0 4.6.9 6.3 2.5.1.1.3.1.4 0l1.2-1.2c.1-.1.1-.3 0-.4A11.6 11.6 0 0 0 .6 3.2c-.1.1-.1.3 0 .4l1.2 1.2c.1.1.3.1.4 0A9 9 0 0 1 8.5 2.3Z" />
                    <path d="M8.5 6.1c1.3 0 2.6.5 3.6 1.4.1.1.3.1.4 0l1.2-1.2c.1-.1.1-.3 0-.4a7.6 7.6 0 0 0-10.4 0c-.1.1-.1.3 0 .4l1.2 1.2c.1.1.3.1.4 0 1-.9 2.3-1.4 3.6-1.4Z" />
                    <path d="M10.9 9.2c.1-.1.1-.3 0-.4a3.5 3.5 0 0 0-4.8 0c-.1.1-.1.3 0 .4l2.2 2.2c.1.1.3.1.4 0l2.2-2.2Z" />
                </svg>
                <svg width="27" height="13" viewBox="0 0 27 13">
                    <title>Battery</title>
                    <rect
                        x="0.5"
                        y="0.5"
                        width="23"
                        height="12"
                        rx="3.8"
                        fill="none"
                        stroke="currentColor"
                        opacity="0.4"
                    />
                    <rect x="2" y="2" width="20" height="9" rx="2.5" />
                    <path
                        d="M25 4.5v4c.8-.3 1.5-1.1 1.5-2s-.7-1.7-1.5-2Z"
                        opacity="0.45"
                    />
                </svg>
            </span>
        </div>
    );
}
