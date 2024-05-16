import { useAnimatedRouter } from "@/module/common/hook/useAnimatedRouter";
import { usePathname } from "next/navigation";
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
    const pathname = usePathname();
    const activeClassName = pathname.startsWith(url)
        ? styles["navigation__button--active"]
        : "";
    const { navigateWithTransition } = useAnimatedRouter();

    return (
        <li>
            <button
                type={"button"}
                className={`${styles.navigation__button} ${activeClassName}`}
                onClick={() => navigateWithTransition(url)}
                disabled={disabled}
            >
                {children}
            </button>
        </li>
    );
}
