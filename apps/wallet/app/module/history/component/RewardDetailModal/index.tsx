import { Box } from "@frak-labs/design-system/components/Box";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    DetailSheet,
    DetailSheetBody,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    CalendarIcon,
    CheckIcon,
    GiftIcon,
    HourglassIcon,
    LockIcon,
} from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import {
    formatCurrency,
    type RewardHistoryItem,
} from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { GlassCloseButton } from "@/module/common/component/GlassCloseButton";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { MerchantLogo } from "@/module/history/component/MerchantLogo";
import {
    type PendingReason,
    pendingReason,
} from "@/module/history/utils/pendingReason";
import * as styles from "./index.css";

type RewardDetailModalProps = {
    item: RewardHistoryItem;
    onClose: () => void;
};

export function RewardDetailModal({ item, onClose }: RewardDetailModalProps) {
    const { i18n } = useTranslation();
    const locale = i18n.language;

    return (
        <DetailSheet>
            <DetailSheetHero height={30} surface="overlay" />
            <DetailSheetBody className={styles.body}>
                <GlassCloseButton onClick={onClose} />
                <DetailHeader item={item} locale={locale} />
                <DetailCard item={item} locale={locale} />
            </DetailSheetBody>
        </DetailSheet>
    );
}

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
                            date: formatDayMonth(item.createdAt, locale),
                            time: formatTime(item.createdAt, locale),
                        })}
                    </Text>
                ) : (
                    <Text variant="caption" color="tertiary">
                        {t("reward.detail.updatedAt", {
                            date: formatDayMonth(item.createdAt, locale),
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
                    date: formatDayMonth(item.createdAt, locale),
                    time: formatTime(item.createdAt, locale),
                })}
            </Text>
        </>
    );
}

function DetailCard({
    item,
    locale,
}: {
    item: RewardHistoryItem;
    locale: string;
}) {
    const { t } = useTranslation();
    const amount = formatCurrency(item.amount.eurAmount, "EUR", locale);
    const lost = item.status === "cancelled" || item.status === "expired";
    const displayAmount = lost ? amount : `+${amount}`;

    const isPending = item.status === "pending";
    const reason = isPending ? pendingReason(item) : null;

    return (
        <Stack space="m">
            <InfoCard>
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={
                        !item.purchase
                            ? t("reward.detail.earnedDate")
                            : isPending
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
                                {formatNumericDate(item.createdAt, locale)}
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
                <StatusRow item={item} reason={reason} locale={locale} />
            </InfoCard>
            {reason && (
                <Card padding="default">
                    <Text variant="bodySmall" color="secondary" weight="medium">
                        {t(pendingDisclaimerKeys[reason.kind])}
                    </Text>
                </Card>
            )}
            {item.role === "welcome_bonus" && (
                <Notice
                    tone="success"
                    icon={<GiftIcon width={20} height={20} />}
                >
                    <Text variant="bodySmall" weight="semiBold">
                        {t("reward.frakBonus.detailTitle")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("reward.frakBonus.detailDescription", {
                            merchant: item.merchant.name,
                        })}
                    </Text>
                </Notice>
            )}
            {item.role === "winner" && (
                <Notice
                    tone="success"
                    icon={<GiftIcon width={20} height={20} />}
                >
                    <Text variant="bodySmall" weight="semiBold">
                        {t("reward.gamePrize.detailTitle")}
                    </Text>
                    <Text variant="bodySmall" color="secondary">
                        {t("reward.gamePrize.detailDescription")}
                    </Text>
                </Notice>
            )}
        </Stack>
    );
}

const statusIcons: Partial<
    Record<RewardHistoryItem["status"], typeof HourglassIcon | typeof LockIcon>
> = {
    settled: HourglassIcon,
    pending: LockIcon,
    locked: LockIcon,
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

const pendingDisclaimerKeys = {
    purchase: "reward.detail.pendingDisclaimer",
    date: "reward.pending.availableOnDisclaimer",
    payout: "reward.pending.onItsWayDisclaimer",
} as const satisfies Record<PendingReason["kind"], string>;

function DateRow({
    label,
    timestamp,
    locale,
}: {
    label: string;
    timestamp: number;
    locale: string;
}) {
    return (
        <InfoRow
            labelVariant="bodySmall"
            labelColor="secondary"
            label={label}
            action={
                <Inline space="xs" alignY="center" wrap={false}>
                    <CalendarIcon
                        color={vars.text.secondary}
                        width={16}
                        height={16}
                    />
                    <Text variant="bodySmall" weight="medium">
                        {formatNumericDate(timestamp, locale)}
                    </Text>
                </Inline>
            }
        />
    );
}

function PendingStatusRow({
    item,
    reason,
    locale,
}: {
    item: RewardHistoryItem;
    reason: PendingReason;
    locale: string;
}) {
    const { t } = useTranslation();

    if (reason.kind === "date") {
        return (
            <DateRow
                label={t("reward.pending.availableOnLabel")}
                timestamp={reason.availableAt}
                locale={locale}
            />
        );
    }

    return (
        <>
            <Box paddingX="m" paddingY="s">
                <Text variant="bodySmall" color="warning">
                    {reason.kind === "purchase"
                        ? t("reward.detail.pendingValidation")
                        : t("reward.pending.onItsWay")}
                </Text>
            </Box>
            {reason.kind === "purchase" && item.availableAt && (
                <DateRow
                    label={t("reward.detail.estimatedValidation")}
                    timestamp={item.availableAt}
                    locale={locale}
                />
            )}
        </>
    );
}

function StatusRow({
    item,
    reason,
    locale,
}: {
    item: RewardHistoryItem;
    reason: PendingReason | null;
    locale: string;
}) {
    const { t } = useTranslation();

    if (reason) {
        return <PendingStatusRow item={item} reason={reason} locale={locale} />;
    }

    if (item.status === "locked") {
        return (
            <Box paddingX="m" paddingY="s">
                <Text variant="bodySmall" color="secondary">
                    {t(lockedExplanationKey(item.waitsOnFriend))}
                </Text>
            </Box>
        );
    }

    if (item.status === "consumed" && item.settledAt) {
        return (
            <DateRow
                label={t("reward.detail.creditedOn")}
                timestamp={item.settledAt}
                locale={locale}
            />
        );
    }

    return (
        <InfoRow
            labelVariant="bodySmall"
            labelColor="secondary"
            labelWeight="regular"
            label={t(statusLabelKey(item.status))}
        />
    );
}

/** Only a reward on-chain is to collect; the rest say where they stand. */
function statusLabelKey(status: RewardHistoryItem["status"]) {
    switch (status) {
        case "processing":
        case "bank_depleted":
        case "cancelled":
        case "expired":
            return `reward.status.${status}` as const;
        default:
            return "reward.detail.toCollect";
    }
}

function lockedExplanationKey(waitsOnFriend: boolean | undefined) {
    return waitsOnFriend
        ? "reward.detail.lockedOnFriendExplanation"
        : "reward.detail.lockedExplanation";
}

function formatDayMonth(timestamp: number, locale: string): string {
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

function formatNumericDate(timestamp: number, locale: string): string {
    return new Date(timestamp).toLocaleDateString(locale, {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
}
