import { Grid } from "@/module/common/component/Grid";
import { History } from "@/module/history/component/History";
import styles from "./page.module.css";

export default function HistoryPage() {
    return (
        <Grid className={styles.history}>
            <History />
        </Grid>
    );
}
