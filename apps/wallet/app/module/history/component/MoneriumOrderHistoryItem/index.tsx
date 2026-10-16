import type { MoneriumOrderDto } from "@backend-domain/monerium/schemas";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { BankIcon, HourglassIcon } from "@frak-labs/design-system/icons";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import { OrderStateBadge } from "@/module/history/component/OrderStateBadge";
import { formatHistoryDateTime } from "@/module/history/utils/formatHistoryDateTime";
import { maskIban } from "@/module/monerium/utils/maskIban";
import {
    formatOrderAmount,
    orderAmountColor,
    orderStateColor,
    orderTimestamp,
} from "@/module/monerium/utils/orderDisplay";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./index.css";

/**
 * Renders a Monerium order row in the unified history list. Tapping the row
 * opens a detail modal that mirrors the reward-detail layout.
 */
export function MoneriumOrderHistoryItem({
    order,
}: {
    order: MoneriumOrderDto;
}) {
    const { t, i18n } = useTranslation();
    const date = formatHistoryDateTime(orderTimestamp(order), i18n.language, t);
    const iban = order.counterpart.iban;
    const subtitle = iban ? `${maskIban(iban)} · ${date}` : date;
    const isWaiting = order.state === "placed" || order.state === "pending";

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
                <div className={styles.iconWrapper}>
                    <BankIcon
                        color={vars.text.secondary}
                        width={20}
                        height={20}
                    />
                    <OrderStateBadge state={order.state} />
                </div>
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
                                    color={orderStateColor(order)}
                                    className={styles.statusText}
                                >
                                    {t(`monerium.order.state.${order.state}`)}
                                </Text>
                            )}
                        </Stack>
                    </Stack>
                    <Stack space="xxs" align="right">
                        <Inline space="xxs" alignY="center" wrap={false}>
                            {isWaiting && (
                                <HourglassIcon color={vars.text.secondary} />
                            )}
                            <Text
                                variant="bodySmall"
                                color={orderAmountColor(order)}
                            >
                                {formatOrderAmount(order, i18n.language)}
                            </Text>
                        </Inline>
                    </Stack>
                </Inline>
            </Inline>
        </button>
    );
}
