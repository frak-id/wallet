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
import { useGetUserBalance } from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isCryptoMode } from "@/module/common/utils/walletMode";
import { modalStore } from "@/module/stores/modalStore";
import { useGetPendingRewards } from "../../hooks/useGetPendingRewards";
import * as styles from "./index.css";

export function Balance() {
    const { t } = useTranslation();
    const { userBalance } = useGetUserBalance();
    const navigate = useNavigate();
    const [isHidden, setIsHidden] = useState(false);

    const openModal = modalStore((s) => s.openModal);

    const amount = userBalance?.total?.eurAmount ?? 0;
    const [integerPart, decimalPart] = amount.toFixed(2).split(".");

    const handleTransferClick = () => {
        if (amount <= 0) {
            openModal({ id: "emptyTransfer" });
            return;
        }

        navigate({ to: "/monerium/offramp" });
    };

    const toggleHidden = () => {
        setIsHidden((prev) => !prev);
    };

    const handlePendingClick = () => {
        if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
        }
        if (amount <= 0) {
            openModal({ id: "emptyPendingGains" });
        } else {
            openModal({ id: "pendingGains" });
        }
    };

    const handleLifetimeClick = () => {
        if (amount <= 0) {
            if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
            }
            openModal({ id: "emptyTransferredGains" });
        }
    };

    return (
        <Card className={styles.balanceLayout}>
            <Box className={styles.balanceCardHeader}>
                <Box display={"flex"} flexDirection={"column"} gap={"xs"}>
                    <Box className={styles.headerRow}>
                        <Text variant="bodySmall" color="secondary">
                            {isCryptoMode
                                ? t("common.balance")
                                : t("common.rewards")}
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
                            <>
                                <span className={styles.amountInteger}>
                                    {integerPart}
                                </span>
                                <span className={styles.amountDecimals}>
                                    ,{decimalPart}
                                </span>
                                <span className={styles.currencySuffix}>
                                    EUR
                                </span>
                            </>
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

            <StatCardsRow
                onPendingClick={handlePendingClick}
                onLifetimeClick={handleLifetimeClick}
            />
        </Card>
    );
}

type StatCardsRowProps = {
    onPendingClick: () => void;
    onLifetimeClick: () => void;
};

function StatCardsRow({ onPendingClick, onLifetimeClick }: StatCardsRowProps) {
    const { t } = useTranslation();
    const { userBalance } = useGetUserBalance();
    const { totalClaimable } = useGetPendingRewards();
    const totalEur = userBalance?.total?.eurAmount ?? 0;

    return (
        <Box className={styles.statCardsRow}>
            <Box
                as="button"
                type="button"
                className={styles.statCardButton}
                onClick={onPendingClick}
            >
                <StatCard
                    amount={`${totalClaimable.toFixed(0)}€`}
                    label={t("wallet.stats.pending")}
                    icon={<HourglassIcon width={14} height={14} />}
                />
            </Box>
            <Box
                as="button"
                type="button"
                className={styles.statCardButton}
                onClick={onLifetimeClick}
            >
                <StatCard
                    amount={`${totalEur.toFixed(0)}€`}
                    label={t("wallet.stats.lifetime")}
                    icon={<BarChartIcon width={14} height={14} />}
                />
            </Box>
        </Box>
    );
}
