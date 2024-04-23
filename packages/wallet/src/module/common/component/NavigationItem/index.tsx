import { usePathname, useRouter } from "next/navigation";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type NavigationProps = {
    url: string;
    disabled?: boolean;
};

export function NavigationItem({
    children,
    disabled = false,
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
                disabled={disabled}
            >
                {children}
            </button>
        </li>
    );
}
