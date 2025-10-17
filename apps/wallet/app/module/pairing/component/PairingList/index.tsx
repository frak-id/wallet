import { Button } from "@frak-labs/ui/component/Button";
import { useDeletePairing } from "@frak-labs/wallet-shared/pairing/hook/useDeletePairing";
import { useGetActivePairings } from "@frak-labs/wallet-shared/pairing/hook/useListPairings";
import { pairingKey } from "@frak-labs/wallet-shared/pairing/queryKeys";
import type { Pairing } from "@frak-labs/wallet-shared/pairing/types";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue } from "jotai";
import { Laptop, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { webauthnSessionAtom } from "@/module/common/atoms/session";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import styles from "./index.module.css";

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
            <div className={styles.pairing__list}>
                {pairings?.map((pairing) => (
                    <PairingItem key={pairing.pairingId} pairing={pairing} />
                ))}
            </div>
        </Panel>
    );
}

/**
 * Display a single pairing item
 */
function PairingItem({ pairing }: { pairing: Pairing }) {
    const { t } = useTranslation();

    return (
        <div key={pairing.pairingId} className={styles.pairing__item}>
            <PairingHeader pairing={pairing} />

            <div className={styles.pairing__details}>
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
            </div>

            <PairingFooter pairing={pairing} />
        </div>
    );
}

/**
 * Display the pairing header
 */
function PairingHeader({ pairing }: { pairing: Pairing }) {
    return (
        <div className={styles.pairing__header}>
            <span className={styles.pairing__id}>
                ID: {pairing.pairingId.substring(0, 8)}
            </span>
        </div>
    );
}

/**
 * Display the pairing footer
 */
function PairingFooter({ pairing }: { pairing: Pairing }) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const wallet = useAtomValue(webauthnSessionAtom);

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
        <div className={styles.pairing__footer}>
            <Button
                variant="ghost"
                size="small"
                className={styles.pairing__deleteButton}
                onClick={() => deletePairing({ id: pairing.pairingId })}
            >
                <Trash2 className={styles.pairing__icon} />
                {t("wallet.pairing.list.delete")}
            </Button>
        </div>
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
            <div className={styles.pairing__label}>{label}</div>
            <div className={styles.pairing__value}>{value}</div>
        </>
    );
}
