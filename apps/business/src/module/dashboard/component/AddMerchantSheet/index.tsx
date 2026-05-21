import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { type ReactNode, useState } from "react";
import { MintMerchant } from "@/module/dashboard/component/MintMerchant";

type Props = {
    trigger: ReactNode;
};

export function AddMerchantSheet({ trigger }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>{trigger}</SheetTrigger>
            <SheetContent side="right" size="wide">
                <SheetHeader>
                    <SheetTitle>Add a new merchant</SheetTitle>
                    <SheetDescription>
                        Register your product on Frak to start running
                        campaigns.
                    </SheetDescription>
                </SheetHeader>
                <MintMerchant onSuccess={() => setOpen(false)} />
            </SheetContent>
        </Sheet>
    );
}
