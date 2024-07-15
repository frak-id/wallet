import type { LightNews } from "@/types/News";
import Link from "next/link";
import styles from "./index.module.css";

export function QuickBites({ id, title, summary }: LightNews) {
    return (
        <>
            <Link href={`/article?id=${id}`} className={styles.quickBites}>
                <h2 className={styles.quickBites__title}>{title}</h2>
                {summary && <span>{summary}</span>}
            </Link>
        </>
    );
}
