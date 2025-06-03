import { AlertDialog as AlertDialogShared } from "@shared/module/component/AlertDialog";
import type { AlertDialogComponentProps } from "@shared/module/component/AlertDialog";
import styles from "./index.module.css";

export function AlertDialog({ ...props }: AlertDialogComponentProps) {
    return (
        <AlertDialogShared
            {...props}
            classNameContent={styles.alertDialog__content}
            classNameTitle={styles.alertDialog__title}
        />
    );
}
