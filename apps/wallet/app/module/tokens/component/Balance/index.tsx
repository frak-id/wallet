import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { StatCard } from "@frak-labs/design-system/components/StatCard";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BarChartIcon,
    EyeIcon,
    EyeOffIcon,
    HourglassIcon,
    TransferIcon,
} from "@frak-labs/design-system/icons";
import { formatCurrency, useGetUserBalance } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { modalStore } from "@/module/stores/modalStore";
import { useGetPendingRewards } from "@/module/tokens/hook/useGetPendingRewards";
import { useGetUnpaidRewards } from "@/module/tokens/hook/useGetUnpaidRewards";
import * as styles from "./index.css";

function balanceRuns(amount: number, locale: string) {
    const runs: { decimals: boolean; text: string }[] = [];
    const parts = new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "EUR",
    }).formatToParts(amount);
    for (const part of parts) {
        const decimals = part.type === "decimal" || part.type === "fraction";
        const last = runs.at(-1);
        if (last?.decimals === decimals) last.text += part.value;
        else runs.push({ decimals, text: part.value });
    }
    return runs;
}

export function Balance() {
    const { t, i18n } = useTranslation();
    const { userBalance } = useGetUserBalance();
    const [isHidden, setIsHidden] = useState(
        () => localStorage.getItem("frak_balance_hidden") === "true"
    );

    const openModal = modalStore((s) => s.openModal);

    const amount = userBalance?.total?.eurAmount ?? 0;

    const handleTransferClick = () => {
        if (amount <= 0) {
            openModal({ id: "emptyTransfer" });
            return;
        }

        openModal({ id: "transfer" });
    };

    const toggleHidden = () => {
        setIsHidden((prev) => {
            const next = !prev;
            localStorage.setItem("frak_balance_hidden", String(next));
            return next;
        });
    };

    return (
        <Card className={styles.balanceLayout}>
            <Box className={styles.balanceCardHeader}>
                <Box display={"flex"} flexDirection={"column"} gap={"xs"}>
                    <Box className={styles.headerRow}>
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.balance.label")}
                        </Text>
                        {isHidden ? (
                            <EyeIcon
                                width={16}
                                height={16}
                                className={styles.eyeIcon}
                                onClick={toggleHidden}
                            />
                        ) : (
                            <EyeOffIcon
                                width={16}
                                height={16}
                                className={styles.eyeIcon}
                                onClick={toggleHidden}
                            />
                        )}
                    </Box>

                    <Box className={styles.amountContainer}>
                        {isHidden ? (
                            <span className={styles.amountInteger}>••••</span>
                        ) : (
                            balanceRuns(amount, i18n.language).map((run) => (
                                <span
                                    key={run.text}
                                    className={
                                        run.decimals
                                            ? styles.amountDecimals
                                            : styles.amountInteger
                                    }
                                >
                                    {run.text}
                                </span>
                            ))
                        )}
                    </Box>
                </Box>

                <Button
                    variant="primary"
                    size="large"
                    icon={<TransferIcon width={16} height={16} />}
                    onClick={handleTransferClick}
                >
                    {t("wallet.transferToBank")}
                </Button>
            </Box>

            <StatCardsRow />
        </Card>
    );
}

function StatCardsRow() {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    const { userBalance } = useGetUserBalance();
    const { totalClaimable } = useGetPendingRewards();
    const { totalUnpaid } = useGetUnpaidRewards();
    const totalEur = userBalance?.total?.eurAmount ?? 0;
    const openModal = modalStore((s) => s.openModal);
    const navigate = useNavigate();

    const handlePendingClick = () => {
        if (totalClaimable > 0) {
            openModal({ id: "pendingGains" });
        } else if (totalUnpaid > 0) {
            void navigate({ to: "/history" });
        } else {
            openModal({ id: "emptyPendingGains" });
        }
    };

    const handleLifetimeClick = () => {
        if (totalEur <= 0) {
            openModal({ id: "emptyTransferredGains" });
        }
    };

    return (
        <Box className={styles.statCardsRow}>
            <Box
                as="button"
                type="button"
                className={styles.statCardButton}
                onClick={handlePendingClick}
            >
                <StatCard
                    amount={formatCurrency(
                        totalClaimable + totalUnpaid,
                        "EUR",
                        locale
                    )}
                    label={t("wallet.stats.pending")}
                    icon={<HourglassIcon width={14} height={14} />}
                />
            </Box>
            <Box
                as="button"
                type="button"
                className={styles.statCardButton}
                onClick={handleLifetimeClick}
            >
                <StatCard
                    amount={formatCurrency(totalEur, "EUR", locale)}
                    label={t("wallet.stats.lifetime")}
                    icon={<BarChartIcon width={14} height={14} />}
                    highlighted={totalEur > 0}
                />
            </Box>
        </Box>
    );
}
