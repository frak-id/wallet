import { ChevronRight } from "lucide-react";
import Link from "next/link";
import styles from "./index.module.css";

export function Breadcrumb() {
    return (
        <span className={styles.breadcrumb}>
            <Link href={"/dashboard"}>Dashboard</Link>{" "}
            <ChevronRight size={18} /> Campaign List
        </span>
    );
}
