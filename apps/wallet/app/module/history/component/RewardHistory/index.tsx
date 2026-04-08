import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    ClockHandsIcon,
    EarningsIcon,
    HourglassIcon,
    LockIcon,
} from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import type {
    MerchantInfo,
    RewardHistoryItem as RewardHistoryItemType,
} from "@frak-labs/wallet-shared";
import { useNavigate } from "@tanstack/react-router";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Skeleton } from "@/module/common/component/Skeleton";
import { useGetRewardHistory } from "@/module/history/hook/useGetRewardHistory";
import * as styles from "./index.css";

export function RewardHistoryList() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { items, totalCount, isLoading } = useGetRewardHistory();

    if (isLoading) return <Skeleton count={3} height={110} />;

    if (!items || items.length === 0) {
        return <RewardHistoryEmpty />;
    }

    return (
        <Card padding="none">
            {items.slice(0, 5).map((item) => (
                <RewardHistoryItem
                    key={
                        item.txHash ??
                        `${item.createdAt}-${item.merchant.domain}`
                    }
                    item={item}
                />
            ))}
            {totalCount >= 5 && (
                <Inline space="none" padding="m" align="center">
                    <Button
                        variant="ghost"
                        size="small"
                        width="auto"
                        onClick={() => navigate({ to: "/history" })}
                    >
                        {t("reward.history.seeAll")}
                    </Button>
                </Inline>
            )}
        </Card>
    );
}

function RewardHistoryEmpty() {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <Card className={styles.emptyLayout}>
            <IconCircle>
                <EarningsIcon color={vars.text.action} />
            </IconCircle>
            <Stack space="xxs">
                <Text variant="body" weight="semiBold" as="h3">
                    {t("reward.history.emptyTitle")}
                </Text>
                <Text variant="bodySmall" color="tertiary">
                    {t("reward.history.emptyDescription")}
                </Text>
            </Stack>
            <Button
                variant="secondary"
                size="small"
                width="auto"
                onClick={() => navigate({ to: "/explorer" })}
            >
                {t("reward.history.discover")}
            </Button>
        </Card>
    );
}

export function RewardHistoryItem({ item }: { item: RewardHistoryItemType }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;
    const displayAmount = `+${formatCurrency(item.amount.eurAmount, "EUR", locale)}`;
    const purchaseAmount = item.purchase
        ? `-${formatCurrency(item.purchase.amount, item.purchase.currency, locale)}`
        : undefined;

    return (
        <Inline space="m" padding="m" fill>
            <MerchantLogo merchant={item.merchant} status={item.status} />
            <Inline space="m" align="space-between" fill>
                <Stack space="xxs" className={styles.itemInfo}>
                    <Text variant="body" weight="medium">
                        {item.merchant.name}
                    </Text>
                    <Stack space="none">
                        <Text variant="bodySmall" color="secondary">
                            {formatRewardDate(item.createdAt, locale, t)}
                        </Text>
                        {item.status !== "consumed" && (
                            <Text
                                variant="bodySmall"
                                color={
                                    item.status === "pending"
                                        ? "warning"
                                        : "secondary"
                                }
                                className={styles.statusText}
                            >
                                {t(`reward.status.${item.status}`)}
                            </Text>
                        )}
                    </Stack>
                </Stack>
                <Stack
                    space="xxs"
                    align="right"
                    justify={purchaseAmount ? "space-between" : "end"}
                >
                    {purchaseAmount && (
                        <Text variant="body">{purchaseAmount}</Text>
                    )}
                    <DisplayAmount
                        amount={displayAmount}
                        status={item.status}
                    />
                </Stack>
            </Inline>
        </Inline>
    );
}

function MerchantLogo({
    merchant,
    status,
}: {
    merchant: MerchantInfo;
    status: RewardHistoryItemType["status"];
}) {
    return (
        <div className={styles.merchantLogo}>
            {merchant.logoUrl ? (
                <img
                    src={merchant.logoUrl}
                    alt={merchant.name}
                    className={styles.merchantLogoImg}
                />
            ) : (
                <span className={styles.merchantLogoFallback}>
                    {merchant.name.charAt(0).toUpperCase()}.
                </span>
            )}
            <Badge status={status} />
        </div>
    );
}

// --- Pure helpers ---

function formatRewardDate(
    timestamp: number,
    locale: string,
    t: TFunction
): string {
    const date = new Date(timestamp);
    const now = new Date();

    const time = date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
    });

    if (date.toDateString() === now.toDateString()) {
        return `${t("common.today")}, ${time}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `${t("common.yesterday")}, ${time}`;
    }

    const dayMonth = date.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
    });
    return `${dayMonth}, ${time}`;
}

function formatCurrency(
    amount: number,
    currency: string,
    locale: string
): string {
    return new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
    }).format(amount);
}

// --- Sub-components ---

const displayAmountIcons: Partial<
    Record<
        RewardHistoryItemType["status"],
        typeof HourglassIcon | typeof LockIcon
    >
> = {
    settled: HourglassIcon,
    pending: LockIcon,
};

function DisplayAmount({
    amount,
    status,
}: {
    amount: string;
    status: RewardHistoryItemType["status"];
}) {
    const Icon = displayAmountIcons[status];
    const color = status === "consumed" ? "success" : "disabled";
    return (
        <Inline space="xxs" alignY="center" wrap={false}>
            {Icon && <Icon color={vars.text.secondary} />}
            <Text variant="bodySmall" color={color}>
                {amount}
            </Text>
        </Inline>
    );
}

const badgeIcons: Record<
    "settled" | "pending",
    typeof ClockHandsIcon | typeof LockIcon
> = {
    settled: ClockHandsIcon,
    pending: LockIcon,
};

function Badge({ status }: { status: RewardHistoryItemType["status"] }) {
    if (status !== "settled" && status !== "pending") {
        return null;
    }

    const Icon = badgeIcons[status];
    return (
        <div className={styles.badge}>
            <div className={styles.badgeInner[status]}>
                <Icon color={vars.surface.background} width={12} height={12} />
            </div>
        </div>
    );
}
