import { Link } from "@remix-run/react";
import { ArrowLeft } from "lucide-react";
import type { PropsWithChildren } from "react";
import styles from "./index.module.css";

type BackProps = {
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
};

export function Back({
    children,
    href,
    onClick,
    disabled,
}: PropsWithChildren<BackProps>) {
    return (
        <div
            className={`${styles.back} ${
                disabled ? styles["back--disabled"] : ""
            }`}
        >
            <ArrowLeft />
            {href && (
                <Link to={href} aria-disabled={disabled} viewTransition>
                    {children}
                </Link>
            )}
            {onClick && (
                <button
                    type={"button"}
                    className={"button"}
                    onClick={onClick}
                    disabled={disabled}
                    aria-disabled={disabled}
                >
                    {children}
                </button>
            )}
        </div>
    );
}
