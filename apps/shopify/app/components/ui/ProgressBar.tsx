import styles from "./ProgressBar.module.css";

interface ProgressBarProps {
    progress: number;
    size?: "small" | "medium";
    tone?: "primary" | "success";
}

export function ProgressBar({
    progress,
    size = "medium",
    tone = "primary",
}: ProgressBarProps) {
    const fillColor = tone === "success" ? "#008060" : "#91D0FF";
    const backgroundColor = "#e4e5e7";
    const sizeClass = size === "small" ? styles.small : styles.medium;

    return (
        <div
            className={`${styles.progressBar} ${sizeClass}`}
            style={{
                backgroundColor,
            }}
        >
            <div
                className={styles.fill}
                style={{
                    width: `${Math.min(Math.max(progress, 0), 100)}%`,
                    backgroundColor: fillColor,
                }}
            />
        </div>
    );
}
