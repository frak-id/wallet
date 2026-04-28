import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Text } from "@frak-labs/design-system/components/Text";
import { BinIcon, ClockIcon, LaptopIcon } from "@frak-labs/design-system/icons";
import {
    pairingKey,
    selectWebauthnSession,
    sessionStore,
    useDeletePairing,
} from "@frak-labs/wallet-shared";
import type { Pairing } from "@frak-labs/wallet-shared/pairing/types";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";

function formatDate(value: Date | string | number, language: string) {
    const locale = language?.startsWith("fr") ? "fr-FR" : "en-US";
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "medium",
    }).format(date);
}

export function DeviceCard({ pairing }: { pairing: Pairing }) {
    const { t, i18n } = useTranslation();
    const queryClient = useQueryClient();
    const wallet = sessionStore(selectWebauthnSession);

    const { mutate: deletePairing, isPending } = useDeletePairing({
        mutations: {
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: pairingKey.listByWallet(wallet?.address),
                });
            },
        },
    });

    return (
        <Card padding="none" variant="elevated" className={styles.card}>
            <Inline space="m" alignY="center" paddingX="m" paddingY="s">
                <div className={styles.headerLeft}>
                    <LaptopIcon
                        width={24}
                        height={24}
                        className={styles.laptopIcon}
                    />
                    <Text variant="body" weight="medium">
                        ID {pairing.pairingId.substring(0, 8)}
                    </Text>
                </div>
                <button
                    type="button"
                    className={styles.deleteButton}
                    onClick={() => deletePairing({ id: pairing.pairingId })}
                    disabled={isPending}
                >
                    <BinIcon width={16} height={16} />
                    <Text
                        as="span"
                        variant="bodySmall"
                        weight="medium"
                        color="error"
                    >
                        {t("wallet.pairing.list.delete")}
                    </Text>
                </button>
            </Inline>

            <DetailRow
                label={t("wallet.pairing.list.origin")}
                value={pairing.originName}
            />
            <DetailRow
                label={t("wallet.pairing.list.target")}
                value={pairing.targetName}
            />
            <DetailRow
                label={t("wallet.pairing.list.createdAt")}
                value={formatDate(pairing.createdAt, i18n.language)}
                icon={
                    <ClockIcon
                        width={16}
                        height={16}
                        className={styles.clockIcon}
                    />
                }
            />
            <DetailRow
                label={t("wallet.pairing.list.lastActive")}
                value={formatDate(pairing.lastActiveAt, i18n.language)}
                icon={
                    <ClockIcon
                        width={16}
                        height={16}
                        className={styles.clockIcon}
                    />
                }
            />
        </Card>
    );
}

function DetailRow({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon?: ReactNode;
}) {
    return (
        <Inline space="m" alignY="center" paddingX="m" paddingY="s">
            <div className={styles.detailLeft}>
                <Text
                    as="span"
                    variant="bodySmall"
                    weight="medium"
                    color="secondary"
                >
                    {label}
                </Text>
            </div>
            <div className={styles.detailRight}>
                {icon}
                <Text as="span" variant="bodySmall" weight="medium">
                    {value}
                </Text>
            </div>
        </Inline>
    );
}
