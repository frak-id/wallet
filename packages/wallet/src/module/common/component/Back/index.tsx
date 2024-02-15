import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

export function Back({ children, href }: PropsWithChildren<{ href: string }>) {
    return (
        <div className={styles.back}>
            <ArrowLeft />
            <Link href={href}>{children}</Link>
        </div>
    );
}
