import styles from "./index.module.css";

export function TokenMax({ onClick }: { onClick: () => void }) {
    return (
        <button
            type={"button"}
            className={styles.tokenMax__button}
            onClick={onClick}
        >
            MAX
        </button>
    );
}
