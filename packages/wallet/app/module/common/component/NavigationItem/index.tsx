import { NavLink } from "@remix-run/react";
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
            <NavLink
                className={({ isActive }) =>
                    `${styles.navigation__button} ${isActive ? styles["navigation__button--active"] : ""}`
                }
                to={url}
                viewTransition
            >
                {children}
            </NavLink>
        </li>
    );
}
