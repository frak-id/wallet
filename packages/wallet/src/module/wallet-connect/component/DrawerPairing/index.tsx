import { Drawer, DrawerContent } from "@/module/common/component/Drawer";
import type { Dispatch, PropsWithChildren, SetStateAction } from "react";

export function DrawerPairing({
    children,
    open,
    onOpenChange,
}: PropsWithChildren<{
    open: boolean;
    onOpenChange: Dispatch<SetStateAction<boolean>>;
}>) {
    return (
        <Drawer open={open} onOpenChange={onOpenChange}>
            <DrawerContent>{children}</DrawerContent>
        </Drawer>
    );
}
