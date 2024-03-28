import { AlertDialog } from "@/module/common/component/AlertDialog";
import type { Dispatch, PropsWithChildren, SetStateAction } from "react";

export function AlertDialogPairing({
    children,
    open,
    onOpenChange,
}: PropsWithChildren<{
    open: boolean;
    onOpenChange: Dispatch<SetStateAction<boolean>>;
}>) {
    return (
        <AlertDialog
            text={children}
            open={open}
            onOpenChange={onOpenChange}
            showCloseButton={false}
        />
    );
}
