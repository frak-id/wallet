import { isRunningInProd } from "@frak-labs/app-essentials";
import {
    DetailSheet,
    DetailSheetBody,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BankIcon,
    CloseIcon,
    ExternalLinkIcon,
    LockIcon,
} from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { formatCurrency } from "@frak-labs/wallet-shared";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { arbitrum, arbitrumSepolia } from "viem/chains";
import { GlassCloseButton } from "@/module/common/component/GlassCloseButton";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { maskIban } from "@/module/monerium/utils/maskIban";
import type {
    MoneriumOrder,
    MoneriumOrderState,
} from "@/module/monerium/utils/moneriumTypes";
import * as styles from "./index.css";

type MoneriumOrderDetailModalProps = {
    order: MoneriumOrder;
    onClose: () => void;
};

const explorerUrl = isRunningInProd
    ? arbitrum.blockExplorers.default.url
    : arbitrumSepolia.blockExplorers.default.url;

export function MoneriumOrderDetailModal({
    order,
    onClose,
}: MoneriumOrderDetailModalProps) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;

    return (
        <DetailSheet>
            <DetailSheetHero height={30} className={styles.hero} />
            <DetailSheetBody className={styles.body}>
                <GlassCloseButton onClick={onClose} />
                <DetailHeader order={order} locale={locale} t={t} />
                <DetailCard order={order} t={t} />
            </DetailSheetBody>
        </DetailSheet>
    );
}

// --- Header: bank icon (with badge) + direction + amount + date ---

function DetailHeader({
    order,
    locale,
    t,
}: {
    order: MoneriumOrder;
    locale: string;
    t: TFunction;
}) {
    const numericAmount = Number.parseFloat(order.amount);
    const formattedAmount = Number.isFinite(numericAmount)
        ? formatCurrency(numericAmount, "EUR", locale)
        : order.amount;
    const sign = order.kind === "redeem" ? "-" : "+";
    const displayAmount = `${sign}${formattedAmount}`;

    const amountColor =
        order.state === "processed"
            ? order.kind === "issue"
                ? "success"
                : "primary"
            : "disabled";

    const walletName = t("monerium.order.detail.walletName");
    const iban = order.counterpart.identifier.iban;
    const ibanLabel = iban ? maskIban(iban) : t("monerium.order.detail.bank");

    const directionLabel =
        order.kind === "redeem"
            ? `${walletName} → ${ibanLabel}`
            : `${ibanLabel} → ${walletName}`;

    return (
        <Stack space="s" className={styles.headerSection}>
            <OrderHeroIcon state={order.state} />
            <Stack space="xs">
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {directionLabel}
                </Text>
                <Text variant="heading2" weight="semiBold" color={amountColor}>
                    {displayAmount}
                </Text>
                <Text variant="caption" color="tertiary">
                    {formatOrderDateTime(order, locale, t)}
                </Text>
                {order.state !== "processed" && (
                    <Text
                        variant="bodySmall"
                        color={order.state === "rejected" ? "error" : "warning"}
                        weight="medium"
                    >
                        {t(`monerium.order.state.${order.state}`)}
                    </Text>
                )}
            </Stack>
        </Stack>
    );
}

function OrderHeroIcon({ state }: { state: MoneriumOrderState }) {
    return (
        <div className={styles.heroIconWrapper}>
            <BankIcon color={vars.text.secondary} width={32} height={32} />
            <HeroBadge state={state} />
        </div>
    );
}

function HeroBadge({ state }: { state: MoneriumOrderState }) {
    if (state === "placed" || state === "pending") {
        return (
            <div className={styles.heroBadge}>
                <div className={styles.heroBadgeInner.pending}>
                    <LockIcon
                        color={vars.surface.background}
                        width={14}
                        height={14}
                    />
                </div>
            </div>
        );
    }
    if (state === "rejected") {
        return (
            <div className={styles.heroBadge}>
                <div className={styles.heroBadgeInner.rejected}>
                    <CloseIcon
                        color={vars.surface.background}
                        width={14}
                        height={14}
                    />
                </div>
            </div>
        );
    }
    return null;
}

// --- Detail card ---

function DetailCard({ order, t }: { order: MoneriumOrder; t: TFunction }) {
    const memo = order.memo?.trim();
    const walletName = t("monerium.order.detail.walletName");
    const iban = order.counterpart.identifier.iban;
    const ibanLabel = iban ? maskIban(iban) : t("monerium.order.detail.bank");

    // For redeem: from wallet → to IBAN. For issue: from IBAN → to wallet.
    const fromLabel = order.kind === "redeem" ? walletName : ibanLabel;
    const toLabel = order.kind === "redeem" ? ibanLabel : walletName;

    const txHash = order.meta.txHashes?.[0];

    return (
        <Stack space="m">
            <InfoCard>
                <Inline space="none" padding="m" fill>
                    <Text variant="bodySmall" weight="medium" color={"secondary"}>
                        {memo && memo.length > 0
                            ? memo
                            : t("monerium.order.detail.noNote")}
                    </Text>
                </Inline>
            </InfoCard>
            <InfoCard>
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("monerium.order.detail.from")}
                    action={
                        <Text variant="bodySmall" weight="medium">
                            {fromLabel}
                        </Text>
                    }
                />
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("monerium.order.detail.to")}
                    action={
                        <Text variant="bodySmall" weight="medium">
                            {toLabel}
                        </Text>
                    }
                />
            </InfoCard>
            {txHash && (
                <InfoCard>
                    <InfoRow
                        labelVariant="bodySmall"
                        labelColor="secondary"
                        label={t("monerium.order.detail.transaction")}
                        href={`${explorerUrl}/tx/${txHash}`}
                        action={
                            <Inline space="xxs" alignY="center" wrap={false}>
                                <Text variant="bodySmall" weight="medium">
                                    {shortenHash(txHash)}
                                </Text>
                                <ExternalLinkIcon
                                    color={vars.text.secondary}
                                    width={16}
                                    height={16}
                                />
                            </Inline>
                        }
                    />
                </InfoCard>
            )}
        </Stack>
    );
}

// --- Helpers ---

function formatOrderDateTime(
    order: MoneriumOrder,
    locale: string,
    t: TFunction
): string {
    const sourceIso = order.meta.processedAt ?? order.meta.placedAt;
    const parsed = sourceIso ? Date.parse(sourceIso) : Number.NaN;
    if (!Number.isFinite(parsed)) return "";

    const date = new Date(parsed);
    const now = new Date();
    const time = date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
    });

    if (date.toDateString() === now.toDateString()) {
        return `${t("common.today")} · ${time}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
        return `${t("common.yesterday")} · ${time}`;
    }

    const dayMonth = date.toLocaleDateString(locale, {
        day: "numeric",
        month: "long",
    });
    return `${dayMonth} · ${time}`;
}

function shortenHash(hash: string): string {
    if (hash.length <= 12) return hash;
    return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}
