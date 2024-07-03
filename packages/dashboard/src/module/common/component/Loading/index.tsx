import { Spinner } from "@module/component/Spinner";
import styles from "./index.module.css";

export function Loading() {
    return (
        <div className={styles.loading}>
            <Spinner />
        </div>
    );
}
