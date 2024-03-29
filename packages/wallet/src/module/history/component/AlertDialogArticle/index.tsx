import { AlertDialog } from "@/module/common/component/AlertDialog";
import type { PropsWithChildren, ReactNode } from "react";
import styles from "./index.module.css";

export function AlertDialogArticle({
    trigger,
    children,
}: PropsWithChildren<{ trigger: ReactNode }>) {
    return (
        <AlertDialog
            text={children}
            button={{
                label: trigger,
                className: styles.alertDialogArticle,
            }}
        />
    );
}
