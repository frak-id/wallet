import type { Stablecoin } from "@frak-labs/app-essentials";
import { Inline } from "@frak-labs/design-system/components/Inline";
import {
    Sheet,
    SheetClose,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
    SheetTrigger,
} from "@frak-labs/design-system/components/Sheet";
import { PauseCircle } from "lucide-react";
import { useState } from "react";
import type { Address } from "viem";
import { Badge } from "@/module/common/component/Badge";
import { Button } from "@/module/common/component/Button";
import { currencyMetadata } from "@/module/common/utils/currencyOptions";
import { useBankAllowanceMutation } from "@/module/merchant/hook/useBankAllowanceMutation";
import * as styles from "./pause-rewards-confirm-sheet.css";

type Token = {
    symbol: string;
    address: Address;
};

type Props = {
    token: Token;
    merchantId: string;
    bankAddress: Address;
    disabled?: boolean;
};

export function PauseRewardsConfirmSheet({
    token,
    merchantId,
    bankAddress,
    disabled,
}: Props) {
    const [open, setOpen] = useState(false);
    const { mutate: revokeAllowance, isPending } = useBankAllowanceMutation({
        bankAddress,
        merchantId,
        action: "revoke",
    });

    const stablecoin = token.symbol as Stablecoin;
    const meta = currencyMetadata[stablecoin];

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button size="small" variant="ghost" disabled={disabled}>
                    <PauseCircle width={14} height={14} />
                    Pause rewards
                </Button>
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>Pause rewards</SheetTitle>
                    <SheetDescription>
                        Active campaigns will stop distributing rewards for this
                        currency until you re-enable the allowance.
                    </SheetDescription>
                </SheetHeader>

                <div className={styles.body}>
                    <div>
                        <h3 className={styles.sectionTitle}>Currency</h3>
                        <div className={styles.sectionBody}>
                            <Inline space="m" alignY="center">
                                <span className={styles.currencyValue}>
                                    {meta.currencySymbol}
                                </span>
                                <Badge size="small" variant="secondary">
                                    {meta.provider}
                                </Badge>
                            </Inline>
                        </div>
                    </div>
                </div>

                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="secondary" disabled={isPending}>
                            Cancel
                        </Button>
                    </SheetClose>
                    <Button
                        variant="destructive"
                        loading={isPending}
                        disabled={isPending}
                        onClick={() =>
                            revokeAllowance(
                                { token: token.address },
                                {
                                    onSuccess: () => setOpen(false),
                                }
                            )
                        }
                    >
                        Pause rewards
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}
