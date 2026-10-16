import type { MoneriumOrderDto } from "@backend-domain/monerium/schemas";
import {
    DetailSheet,
    DetailSheetBody,
    DetailSheetHero,
} from "@frak-labs/design-system/components/DetailSheet";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { BankIcon, ExternalLinkIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { GlassCloseButton } from "@/module/common/component/GlassCloseButton";
import { InfoCard, InfoRow } from "@/module/common/component/InfoCard";
import { OrderStateBadge } from "@/module/history/component/OrderStateBadge";
import { formatHistoryDateTime } from "@/module/history/utils/formatHistoryDateTime";
import { maskIban } from "@/module/monerium/utils/maskIban";
import {
    formatOrderAmount,
    orderAmountColor,
    orderStateColor,
    orderTimestamp,
} from "@/module/monerium/utils/orderDisplay";
import { explorerTxUrl } from "@/module/wallet/component/ExplorerLink";
import * as styles from "./index.css";

type MoneriumOrderDetailModalProps = {
    order: MoneriumOrderDto;
    onClose: () => void;
};

export function MoneriumOrderDetailModal({
    order,
    onClose,
}: MoneriumOrderDetailModalProps) {
    const { t, i18n } = useTranslation();
    const walletName = t("monerium.order.detail.walletName");
    const iban = order.counterpart.iban;
    const ibanLabel = iban ? maskIban(iban) : t("monerium.order.detail.bank");
    const parties =
        order.kind === "redeem"
            ? { from: walletName, to: ibanLabel }
            : { from: ibanLabel, to: walletName };

    return (
        <DetailSheet>
            <DetailSheetHero height={30} surface="overlay" />
            <DetailSheetBody className={styles.body}>
                <GlassCloseButton onClick={onClose} />
                <DetailHeader
                    order={order}
                    parties={parties}
                    locale={i18n.language}
                    t={t}
                />
                <DetailCard order={order} parties={parties} t={t} />
            </DetailSheetBody>
        </DetailSheet>
    );
}

type Parties = { from: string; to: string };

function DetailHeader({
    order,
    parties,
    locale,
    t,
}: {
    order: MoneriumOrderDto;
    parties: Parties;
    locale: string;
    t: TFunction;
}) {
    return (
        <Stack space="s" className={styles.headerSection}>
            <div className={styles.heroIconWrapper}>
                <BankIcon color={vars.text.secondary} width={32} height={32} />
                <OrderStateBadge state={order.state} size="m" />
            </div>
            <Stack space="xs">
                <Text variant="bodySmall" weight="medium" color="secondary">
                    {`${parties.from} → ${parties.to}`}
                </Text>
                <Text
                    variant="heading2"
                    weight="semiBold"
                    color={orderAmountColor(order)}
                >
                    {formatOrderAmount(order, locale)}
                </Text>
                <Text variant="caption" color="tertiary">
                    {formatHistoryDateTime(
                        orderTimestamp(order),
                        locale,
                        t,
                        " · "
                    )}
                </Text>
                {order.state !== "processed" && (
                    <Text
                        variant="bodySmall"
                        color={orderStateColor(order)}
                        weight="medium"
                    >
                        {t(`monerium.order.state.${order.state}`)}
                    </Text>
                )}
            </Stack>
        </Stack>
    );
}

function DetailCard({
    order,
    parties,
    t,
}: {
    order: MoneriumOrderDto;
    parties: Parties;
    t: TFunction;
}) {
    const memo = order.memo?.trim();
    const txHash = order.txHashes[0];

    return (
        <Stack space="m">
            <InfoCard>
                <Inline space="none" padding="m" fill>
                    <Text
                        variant="bodySmall"
                        weight="medium"
                        color={"secondary"}
                    >
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
                            {parties.from}
                        </Text>
                    }
                />
                <InfoRow
                    labelVariant="bodySmall"
                    labelColor="secondary"
                    label={t("monerium.order.detail.to")}
                    action={
                        <Text variant="bodySmall" weight="medium">
                            {parties.to}
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
                        href={explorerTxUrl(txHash)}
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

function shortenHash(hash: string): string {
    if (hash.length <= 12) return hash;
    return `${hash.slice(0, 6)}…${hash.slice(-4)}`;
}
