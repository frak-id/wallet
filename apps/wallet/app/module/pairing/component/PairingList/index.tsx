import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    pairingKey,
    selectWebauthnSession,
    sessionStore,
    useDeletePairing,
    useGetActivePairings,
} from "@frak-labs/wallet-shared";
import type { Pairing } from "@frak-labs/wallet-shared/pairing/types";
import { useQueryClient } from "@tanstack/react-query";
import { Laptop, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import * as styles from "./index.css";

/**
 * List all the active pairings
 */
export function PairingList() {
    const { data: pairings } = useGetActivePairings();
    const { t } = useTranslation();

    if (!pairings?.length) return null;

    return (
        <Panel size={"small"}>
            <Title icon={<Laptop size={32} />}>
                {t("wallet.pairing.list.title")}
            </Title>
            <Box className={styles.pairingList}>
                {pairings?.map((pairing: Pairing) => (
                    <PairingItem key={pairing.pairingId} pairing={pairing} />
                ))}
            </Box>
        </Panel>
    );
}

/**
 * Display a single pairing item
 */
function PairingItem({ pairing }: { pairing: Pairing }) {
    const { t } = useTranslation();

    return (
        <Box className={styles.pairingItem}>
            <PairingItemHeader pairing={pairing} />

            <Box className={styles.pairingDetails}>
                <PairingSingleDetails
                    label={t("wallet.pairing.list.origin")}
                    value={pairing.originName}
                />
                <PairingSingleDetails
                    label={t("wallet.pairing.list.target")}
                    value={pairing.targetName}
                />
                <PairingSingleDetails
                    label={t("wallet.pairing.list.createdAt")}
                    value={new Date(pairing.createdAt).toLocaleString()}
                />
                <PairingSingleDetails
                    label={t("wallet.pairing.list.lastActive")}
                    value={new Date(pairing.lastActiveAt).toLocaleString()}
                />
            </Box>

            <PairingItemFooter pairing={pairing} />
        </Box>
    );
}

/**
 * Display the pairing header
 */
function PairingItemHeader({ pairing }: { pairing: Pairing }) {
    return (
        <Box className={styles.pairingHeader}>
            <Text as="span" className={styles.pairingId}>
                ID: {pairing.pairingId.substring(0, 8)}
            </Text>
        </Box>
    );
}

/**
 * Display the pairing footer
 */
function PairingItemFooter({ pairing }: { pairing: Pairing }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const wallet = sessionStore(selectWebauthnSession);

    const { mutate: deletePairing } = useDeletePairing({
        mutations: {
            onSuccess: () => {
                queryClient.invalidateQueries({
                    queryKey: pairingKey.listByWallet(wallet?.address),
                });
            },
        },
    });

    return (
        <Box className={styles.pairingFooter}>
            <Button
                variant="outlined"
                className={styles.pairingDeleteButton}
                onClick={() => deletePairing({ id: pairing.pairingId })}
            >
                <Trash2 className={styles.pairingIcon} />
                {t("wallet.pairing.list.delete")}
            </Button>
        </Box>
    );
}

/**
 * Display a single pairing detail
 */
function PairingSingleDetails({
    label,
    value,
}: {
    label: string;
    value: string;
}) {
    return (
        <>
            <Text as="span" className={styles.pairingLabel}>
                {label}
            </Text>
            <Text as="span" className={styles.pairingValue}>
                {value}
            </Text>
        </>
    );
}
