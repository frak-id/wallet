import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    DetailSheet,
    DetailSheetBody,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CalendarIcon,
    CheckIcon,
    CloseIcon,
    HourglassIcon,
    LockIcon,
} from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import type { RewardHistoryItem } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { GlassButton } from "@/module/common/component/GlassButton";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { MerchantLogo } from "@/module/history/component/MerchantLogo";
import * as styles from "./index.css";

type RewardDetailModalProps = {
    item: RewardHistoryItem;
    onClose: () => void;
};

export function RewardDetailModal({ item, onClose }: RewardDetailModalProps) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;

    return (
        <DetailSheet>
            <DetailSheetHero height={30} className={styles.hero} />
            <DetailSheetBody className={styles.body}>
                <GlassButton
                    as="button"
                    icon={<CloseIcon />}
                    onClick={onClose}
                    aria-label={t("common.close")}
                />
                <DetailHeader item={item} locale={locale} />
                <DetailCard item={item} locale={locale} />
            </DetailSheetBody>
        </DetailSheet>
    );
}

// --- Header: logo + merchant name + subtitle ---

function DetailHeader({
    item,
    locale,
}: {
    item: RewardHistoryItem;
    locale: string;
}) {
    const { t } = useTranslation();

    return (
        <Stack space="s" className={styles.headerSection}>
            <MerchantLogo merchant={item.merchant} size="large" />
            <Stack space="xs">
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {item.merchant.name}
                </Text>
                {item.purchase ? (
                    <PurchaseHeader item={item} locale={locale} />
                ) : item.status === "pending" ? (
                    <Text variant="caption" color="tertiary">
                        {t("reward.detail.generatedOn", {
                            date: formatShortDate(item.createdAt, locale),
                            time: formatTime(item.createdAt, locale),
                        })}
                    </Text>
                ) : (
                    <Text variant="caption" color="tertiary">
                        {t("reward.detail.updatedAt", {
                            date: formatShortDate(item.createdAt, locale),
                            time: formatTime(item.createdAt, locale),
                        })}
                    </Text>
                )}
            </Stack>
        </Stack>
    );
}

function PurchaseHeader({
    item,
    locale,
}: {
    item: RewardHistoryItem;
    locale: string;
}) {
    const { t } = useTranslation();
    const purchase = item.purchase;
    if (!purchase) return null;

    const purchaseAmount = `-${formatCurrency(purchase.amount, purchase.currency, locale)}`;

    return (
        <>
            <Text variant="heading2" weight="semiBold">
                {purchaseAmount}
            </Text>
            <Text variant="caption" color="tertiary">
                {t("reward.detail.purchaseMadeOn", {
                    date: formatShortDate(item.createdAt, locale),
                    time: formatTime(item.createdAt, locale),
                })}
            </Text>
        </>
    );
}

// --- Detail card with rows ---

function DetailCard({
    item,
    locale,
}: {
    item: RewardHistoryItem;
    locale: string;
}) {
    const { t } = useTranslation();
    const displayAmount = `+${formatCurrency(item.amount.eurAmount, "EUR", locale)}`;

    const isPending = item.status === "pending";

    return (
        <Stack space="m">
            <InfoCard>
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={
                        isPending
                            ? t("reward.detail.generatedDate")
                            : t("reward.detail.purchaseDate")
                    }
                    action={
                        <Inline space="xxs" alignY="center" wrap={false}>
                            <CalendarIcon
                                color={vars.text.secondary}
                                width={16}
                                height={16}
                            />
                            <Text variant="bodySmall" weight="medium">
                                {formatDateShort(item.createdAt, locale)}
                            </Text>
                        </Inline>
                    }
                />
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("reward.detail.rewardGenerated")}
                    action={
                        <RewardAmountDisplay
                            amount={displayAmount}
                            status={item.status}
                        />
                    }
                />
                <StatusRow item={item} locale={locale} />
            </InfoCard>
            {isPending && (
                <Card padding="default">
                    <Text variant="bodySmall" color="secondary" weight="medium">
                        {t("reward.detail.pendingDisclaimer")}
                    </Text>
                </Card>
            )}
        </Stack>
    );
}

const statusIcons: Partial<
    Record<RewardHistoryItem["status"], typeof HourglassIcon | typeof LockIcon>
> = {
    settled: HourglassIcon,
    pending: LockIcon,
};

function RewardAmountDisplay({
    amount,
    status,
}: {
    amount: string;
    status: RewardHistoryItem["status"];
}) {
    if (status === "consumed") {
        return (
            <Inline space="xxs" alignY="center" wrap={false}>
                <Text variant="bodySmall" color="success" weight="medium">
                    {amount}
                </Text>
                <div className={styles.checkBadge}>
                    <CheckIcon
                        color={vars.surface.background}
                        width={15}
                        height={15}
                    />
                </div>
            </Inline>
        );
    }

    const Icon = statusIcons[status];

    return (
        <Inline space="xxs" alignY="center" wrap={false}>
            {Icon && <Icon color={vars.text.secondary} />}
            <Text variant="bodySmall" color="disabled" weight="medium">
                {amount}
            </Text>
        </Inline>
    );
}

function StatusRow({
    item,
    locale,
}: {
    item: RewardHistoryItem;
    locale: string;
}) {
    const { t } = useTranslation();

    if (item.status === "pending") {
        return (
            <>
                <Box paddingX="m" paddingY="s">
                    <Text variant="bodySmall" color="warning">
                        {t("reward.detail.pendingValidation")}
                    </Text>
                </Box>
                {item.settledAt && (
                    <InfoRow
                        labelVariant="bodySmall"
                        labelColor="secondary"
                        label={t("reward.detail.estimatedValidation")}
                        action={
                            <Inline space="xs" alignY="center" wrap={false}>
                                <CalendarIcon
                                    color={vars.text.secondary}
                                    width={16}
                                    height={16}
                                />
                                <Text variant="bodySmall" weight="medium">
                                    {formatDateShort(item.settledAt, locale)}
                                </Text>
                            </Inline>
                        }
                    />
                )}
            </>
        );
    }

    if (item.status === "consumed" && item.settledAt) {
        return (
            <InfoRow
                labelVariant="bodySmall"
                labelColor="secondary"
                label={t("reward.detail.creditedOn")}
                action={
                    <Inline space="xs" alignY="center" wrap={false}>
                        <CalendarIcon
                            color={vars.text.secondary}
                            width={16}
                            height={16}
                        />
                        <Text variant="bodySmall" weight="medium">
                            {formatDateShort(item.settledAt, locale)}
                        </Text>
                    </Inline>
                }
            />
        );
    }

    return (
        <InfoRow
            labelVariant="bodySmall"
            labelColor="secondary"
            labelWeight="regular"
            label={t("reward.detail.toCollect")}
        />
    );
}

// --- Pure formatting helpers ---

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

function formatShortDate(timestamp: number, locale: string): string {
    return new Date(timestamp).toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
    });
}

function formatTime(timestamp: number, locale: string): string {
    return new Date(timestamp).toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function formatDateShort(timestamp: number, locale: string): string {
    return new Date(timestamp).toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}
