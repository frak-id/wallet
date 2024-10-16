import { prefixModalCss } from "@module/utils/prefixModalCss";
import type { ButtonHTMLAttributes } from "react";
import styles from "./index.module.css";

export function ButtonAction(props: ButtonHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type={"button"}
            className={`${styles.buttonAction} ${prefixModalCss("button-action")}`}
            {...props}
        />
    );
}
