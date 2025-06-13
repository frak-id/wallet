import { AlertDialog as AlertDialogShared } from "@frak-labs/ui/component/AlertDialog";
import type { AlertDialogComponentProps } from "@frak-labs/ui/component/AlertDialog";
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
