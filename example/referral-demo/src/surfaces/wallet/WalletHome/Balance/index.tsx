import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { StatCard } from "@frak-labs/design-system/components/StatCard";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BarChartIcon,
    EyeOffIcon,
    HourglassIcon,
    TransferIcon,
} from "@frak-labs/design-system/icons";
import { animate } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/i18n";
import { useFormatMoney } from "@/i18n/format";
import { TapHalo } from "../../components/TapHalo";
import { walletMessages } from "../../messages";
import * as styles from "./balance.css";

/** Shows `value`, counting up to it whenever it changes after mount. */
function useCountUp(value: number) {
    const [display, setDisplay] = useState(value);
    const shown = useRef(value);

    useEffect(() => {
        if (shown.current === value) return;
        const controls = animate(shown.current, value, {
            duration: 1.2,
            ease: [0.16, 1, 0.3, 1],
            onUpdate: (latest) => {
                shown.current = latest;
                setDisplay(latest);
            },
        });
        return () => controls.stop();
    }, [value]);

    return display;
}

/** The wallet's balance card: total, transfer CTA, pending and lifetime stats. */
export function Balance({
    balance,
    pending,
    lifetime,
    onPendingClick,
    onTransfer,
}: {
    balance: number;
    pending: number;
    lifetime: number;
    onPendingClick: () => void;
    /** Set when the transfer CTA moves the story on: it also gets a halo. */
    onTransfer?: () => void;
}) {
    const t = useT(walletMessages);
    const money = useFormatMoney();
    const shown = useCountUp(balance);
    const decimalMark = useLang() === "fr" ? "," : ".";
    const [integerPart, decimalPart] = shown.toFixed(2).split(".");

    return (
        <Card className={styles.balanceLayout}>
            <div className={styles.balanceCardHeader}>
                <Stack space="xs">
                    <Inline space="xs" align="center" alignY="center">
                        <Text variant="bodySmall" color="secondary">
                            {t("balance.label")}
                        </Text>
                        <EyeOffIcon
                            width={16}
                            height={16}
                            className={styles.eyeIcon}
                        />
                    </Inline>
                    <div className={styles.amountContainer}>
                        <span className={styles.amountInteger}>
                            {integerPart}
                        </span>
                        <span className={styles.amountDecimals}>
                            {decimalMark}
                            {decimalPart}
                        </span>
                        <span className={styles.currencySuffix}>EUR</span>
                    </div>
                </Stack>
                <TapHalo active={!!onTransfer}>
                    <Button
                        variant="primary"
                        size="large"
                        icon={<TransferIcon width={16} height={16} />}
                        onClick={onTransfer}
                    >
                        {t("balance.transfer")}
                    </Button>
                </TapHalo>
            </div>

            <div className={styles.statCardsRow}>
                <button
                    type="button"
                    className={styles.statCardButton}
                    onClick={onPendingClick}
                >
                    <StatCard
                        amount={money(pending)}
                        label={t("balance.pending")}
                        icon={<HourglassIcon width={14} height={14} />}
                    />
                </button>
                <button type="button" className={styles.statCardButton}>
                    <StatCard
                        amount={money(lifetime)}
                        label={t("balance.lifetime")}
                        icon={<BarChartIcon width={14} height={14} />}
                        highlighted={lifetime > 0}
                    />
                </button>
            </div>
        </Card>
    );
}
