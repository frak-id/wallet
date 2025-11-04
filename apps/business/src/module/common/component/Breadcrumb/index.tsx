import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import styles from "./index.module.css";

export function Breadcrumb({ current }: { current: string }) {
    return (
        <span className={styles.breadcrumb}>
            <Link to="/dashboard">Dashboard</Link> <ChevronRight size={18} />{" "}
            {current}
        </span>
    );
}
