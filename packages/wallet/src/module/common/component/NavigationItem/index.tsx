import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type NavigationProps = {
    url: string;
};

export function NavigationItem({
    children,
    url,
}: PropsWithChildren<NavigationProps>) {
    const router = useRouter();
    const pathname = usePathname();
    const activeClassName = pathname.startsWith(url)
        ? styles["navigation__button--active"]
        : "";

    return (
        <li>
            <button
                type={"button"}
                className={`${styles.navigation__button} ${activeClassName}`}
                onClick={() => router.push(url)}
            >
                {children}
            </button>
        </li>
    );
}
