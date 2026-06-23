import { GlassButton } from "@frak-labs/design-system/components/GlassButton";
import { GlassCloseButton } from "@frak-labs/design-system/components/GlassCloseButton";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetTitle,
} from "@frak-labs/design-system/components/Sheet";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { ArrowLeftIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMerchant } from "@/module/merchant/hook/useMerchant";
import { AddFundsView } from "./AddFundsView";
import { BudgetView } from "./BudgetView";
import * as styles from "./manage-budget-sheet.css";

type SheetView = "budget" | "addFunds";

export function ManageBudgetSheet({
    merchantId,
    onClose,
}: {
    merchantId: string;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const { data: merchant } = useMerchant({ merchantId });
    const [view, setView] = useState<SheetView>("budget");

    const isBudget = view === "budget";

    return (
        <Sheet open onOpenChange={(open) => !open && onClose()}>
            <SheetContent
                side="right"
                size="wide"
                padded={false}
                hideCloseButton
            >
                <Stack space="l" padding="l">
                    <header className={styles.header}>
                        {isBudget ? (
                            <GlassCloseButton
                                onClick={onClose}
                                aria-label={t("funding.header.close")}
                            />
                        ) : (
                            <GlassButton
                                as="button"
                                icon={<ArrowLeftIcon width={22} height={22} />}
                                onClick={() => setView("budget")}
                                aria-label={t("funding.header.back")}
                            />
                        )}
                        <Stack space="xs">
                            <SheetTitle className={styles.title}>
                                {isBudget
                                    ? t("funding.header.budgetTitle")
                                    : t("funding.header.addFundsTitle")}
                            </SheetTitle>
                            <SheetDescription className={styles.description}>
                                {isBudget
                                    ? merchant?.domain
                                    : t("funding.header.addFundsDescription")}
                            </SheetDescription>
                        </Stack>
                    </header>

                    {isBudget ? (
                        <BudgetView
                            merchantId={merchantId}
                            onAddFunds={() => setView("addFunds")}
                        />
                    ) : (
                        <AddFundsView merchantId={merchantId} />
                    )}
                </Stack>
            </SheetContent>
        </Sheet>
    );
}
