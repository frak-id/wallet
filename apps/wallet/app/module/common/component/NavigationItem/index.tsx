import { Link } from "@tanstack/react-router";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type NavigationProps = {
    url: string;
};

export function NavigationItem({
    children,
    url,
}: PropsWithChildren<NavigationProps>) {
    return (
        <li>
            <Link
                activeProps={{
                    className: `${styles.navigation__button} ${styles["navigation__button--active"]}`,
                }}
                inactiveProps={{
                    className: styles.navigation__button,
                }}
                to={url}
            >
                {children}
            </Link>
        </li>
    );
}
