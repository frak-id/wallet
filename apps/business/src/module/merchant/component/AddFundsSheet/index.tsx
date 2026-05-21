import { isRunningInProd, type Stablecoin } from "@frak-labs/app-essentials";
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
import { Wallet } from "lucide-react";
import { useState } from "react";
import type { Address } from "viem";
import { Badge } from "@/module/common/component/Badge";
import { Button } from "@/module/common/component/Button";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";
import {
    currencyMetadata,
    formatTokenBalance,
} from "@/module/common/utils/currencyOptions";
import { useFundTestBank } from "@/module/merchant/hook/useFundTestBank";
import * as styles from "./add-funds-sheet.css";

type Token = {
    symbol: string;
    address: Address;
    balance: bigint;
    allowance: bigint;
};

type Props = {
    tokens: Token[];
    bankAddress: Address;
};

export function AddFundsSheet({ tokens, bankAddress }: Props) {
    const [open, setOpen] = useState(false);

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
                <Button variant="primary">Add funds</Button>
            </SheetTrigger>
            <SheetContent side="right">
                <SheetHeader>
                    <SheetTitle>Add funds</SheetTitle>
                    <SheetDescription>
                        Top up your reward budget. Stripe handles the amount and
                        payment method.
                    </SheetDescription>
                </SheetHeader>

                <div className={styles.body}>
                    <Section title="Current balance">
                        {tokens.map((token) => (
                            <BalanceRow key={token.address} token={token} />
                        ))}
                    </Section>

                    <Section title="Payment options">
                        <div className={styles.paymentOptions}>
                            <Button
                                as="a"
                                href={process.env.FUNDING_ON_RAMP_URL ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="primary"
                                onClick={() => setOpen(false)}
                            >
                                Add funds via Stripe
                            </Button>
                            {!isRunningInProd && (
                                <TestFundButton
                                    bankAddress={bankAddress}
                                    onDone={() => setOpen(false)}
                                />
                            )}
                        </div>
                    </Section>
                </div>

                <SheetFooter>
                    <SheetClose asChild>
                        <Button variant="ghost">Close</Button>
                    </SheetClose>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

function Section({
    title,
    children,
}: {
    title: string;
    children: React.ReactNode;
}) {
    return (
        <div>
            <h3 className={styles.sectionTitle}>{title}</h3>
            <div className={styles.sectionBody}>{children}</div>
        </div>
    );
}

function BalanceRow({ token }: { token: Token }) {
    const stablecoin = token.symbol as Stablecoin;
    const meta = currencyMetadata[stablecoin];
    const { data: tokenMeta } = useTokenMetadata(token.address);
    const decimals = tokenMeta?.decimals ?? 18;
    const formattedBalance = formatTokenBalance(
        token.balance,
        stablecoin,
        decimals
    );

    return (
        <div className={styles.balanceRow}>
            <span className={styles.balanceLabel}>
                {meta.currencySymbol}{" "}
                <Badge size="small" variant="secondary">
                    {meta.provider}
                </Badge>
            </span>
            <span className={styles.balanceValue}>{formattedBalance}</span>
        </div>
    );
}

function TestFundButton({
    bankAddress,
    onDone,
}: {
    bankAddress: Address;
    onDone?: () => void;
}) {
    const { mutate: fundTestBank, isPending } = useFundTestBank();

    return (
        <Button
            variant="secondary"
            onClick={() =>
                fundTestBank(
                    { bank: bankAddress },
                    {
                        onSuccess: () => onDone?.(),
                    }
                )
            }
            disabled={isPending}
            loading={isPending}
        >
            <Wallet width={16} height={16} />
            Fund with Test Tokens
        </Button>
    );
}
