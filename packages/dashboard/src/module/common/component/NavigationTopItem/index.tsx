"use client";

import { useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type NavigationTopItemProps = {
    url: string;
};

export function NavigationTopItem({
    children,
    url,
}: PropsWithChildren<NavigationTopItemProps>) {
    const router = useRouter();

    return (
        <li>
            <button
                type={"button"}
                className={`${styles.navigationTopItem__button}`}
                onClick={() => router.push(url)}
            >
                {children}
            </button>
        </li>
    );
}
