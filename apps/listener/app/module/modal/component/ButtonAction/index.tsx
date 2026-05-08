import { prefixModalCss } from "@frak-labs/wallet-shared/common";
import type { ComponentProps } from "react";
import * as styles from "./index.css";

export function ButtonAction(props: ComponentProps<"button">) {
    return (
        <button
            type={"button"}
            className={`${styles.buttonAction} ${prefixModalCss("button-action")}`}
            {...props}
        />
    );
}
