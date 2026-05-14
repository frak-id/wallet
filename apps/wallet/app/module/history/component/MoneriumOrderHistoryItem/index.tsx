import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    BankIcon,
    CloseIcon,
    HourglassIcon,
    LockIcon,
} from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { formatCurrency } from "@frak-labs/wallet-shared";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { maskIban } from "@/module/monerium/utils/maskIban";
import type {
    MoneriumOrder,
    MoneriumOrderState,
} from "@/module/monerium/utils/moneriumTypes";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

/**
 * Renders a Monerium order row in the unified history list. Tapping the row
 * opens a detail modal that mirrors the reward-detail layout, so the two
 * surfaces feel like siblings rather than ad-hoc screens.
 */
export function MoneriumOrderHistoryItem({ order }: { order: MoneriumOrder }) {
    const { t, i18n } = useTranslation();
    const locale = i18n.language;

    const numericAmount = Number.parseFloat(order.amount);
    const formattedAmount = Number.isFinite(numericAmount)
        ? formatCurrency(numericAmount, "EUR", locale)
        : order.amount;
    // Redeem = outgoing (burn). Issue = incoming (mint).
    const sign = order.kind === "redeem" ? "-" : "+";
    const displayAmount = `${sign}${formattedAmount}`;

    const subtitle = buildSubtitle(order, locale, t);

    return (
        <button
            type="button"
            className={styles.row}
            onClick={() =>
                modalStore
                    .getState()
                    .openModal({ id: "moneriumOrderDetail", order })
            }
        >
            <Inline space="m" padding="m" fill>
                <OrderIcon state={order.state} />
                <Inline space="m" align="space-between" fill>
                    <Stack space="xxs" className={styles.info}>
                        <Text variant="body" weight="medium">
                            {t(`monerium.order.kind.${order.kind}`)}
                        </Text>
                        <Stack space="none">
                            <Text variant="bodySmall" color="secondary">
                                {subtitle}
                            </Text>
                            {order.state !== "processed" && (
                                <Text
                                    variant="bodySmall"
                                    color={
                                        order.state === "rejected"
                                            ? "error"
                                            : "warning"
                                    }
                                    className={styles.statusText}
                                >
                                    {t(`monerium.order.state.${order.state}`)}
                                </Text>
                            )}
                        </Stack>
                    </Stack>
                    <Stack space="xxs" align="right">
                        <DisplayAmount
                            amount={displayAmount}
                            state={order.state}
                            kind={order.kind}
                        />
                    </Stack>
                </Inline>
            </Inline>
        </button>
    );
}

// --- Sub-components ---

function OrderIcon({ state }: { state: MoneriumOrderState }) {
    return (
        <div className={styles.iconWrapper}>
            <BankIcon color={vars.text.secondary} width={20} height={20} />
            <Badge state={state} />
        </div>
    );
}

function Badge({ state }: { state: MoneriumOrderState }) {
    if (state === "placed" || state === "pending") {
        return (
            <div className={styles.badge}>
                <div className={styles.badgeInner.pending}>
                    <LockIcon
                        color={vars.surface.background}
                        width={12}
                        height={12}
                    />
                </div>
            </div>
        );
    }
    if (state === "rejected") {
        return (
            <div className={styles.badge}>
                <div className={styles.badgeInner.rejected}>
                    <CloseIcon
                        color={vars.surface.background}
                        width={12}
                        height={12}
                    />
                </div>
            </div>
        );
    }
    return null;
}

function DisplayAmount({
    amount,
    state,
    kind,
}: {
    amount: string;
    state: MoneriumOrderState;
    kind: MoneriumOrder["kind"];
}) {
    if (state === "rejected") {
        return (
            <Text variant="bodySmall" color="disabled">
                {amount}
            </Text>
        );
    }
    const Icon =
        state === "placed" || state === "pending" ? HourglassIcon : undefined;
    const color =
        state === "processed"
            ? kind === "issue"
                ? "success"
                : "primary"
            : "disabled";
    return (
        <Inline space="xxs" alignY="center" wrap={false}>
            {Icon && <Icon color={vars.text.secondary} />}
            <Text variant="bodySmall" color={color}>
                {amount}
            </Text>
        </Inline>
    );
}

// --- Helpers ---

function buildSubtitle(
    order: MoneriumOrder,
    locale: string,
    t: TFunction
): string {
    const date = formatOrderDate(order, locale, t);
    const iban = order.counterpart.identifier.iban;
    return iban ? `${maskIban(iban)} · ${date}` : date;
}

function formatOrderDate(
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
