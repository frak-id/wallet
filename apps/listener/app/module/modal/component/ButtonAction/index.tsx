import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import type { ComponentProps } from "react";
import styles from "./index.module.css";

export function ButtonAction(props: ComponentProps<"button">) {
    return (
        <button
            type={"button"}
            className={`${styles.buttonAction} ${prefixModalCss("button-action")}`}
            {...props}
        />
    );
}
