"use client";

import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type NavigationItemProps = {
    url: string;
    className?: string;
};

export function NavigationItem({
    children,
    url,
    className = "",
}: PropsWithChildren<NavigationItemProps>) {
    const router = useRouter();
    const pathname = usePathname();
    const activeClassName = pathname.startsWith(url)
        ? styles["navigationItem__button--active"]
        : "";

    return (
        <li className={className}>
            <button
                type={"button"}
                className={`${styles.navigationItem__button} ${activeClassName}`}
                onClick={() => router.push(url)}
            >
                {children}
            </button>
        </li>
    );
}
