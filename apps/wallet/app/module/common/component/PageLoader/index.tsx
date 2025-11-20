import { Spinner } from "@frak-labs/ui/component/Spinner";
import styles from "./index.module.css";

/**
 * PageLoader
 *
 * Loading component for lazy-loaded pages
 * Provides consistent padding around the spinner
 *
 * @returns {JSX.Element} The rendered page loader
 */
export function PageLoader() {
    return (
        <div className={styles.pageLoader}>
            <Spinner />
        </div>
    );
}
