import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExplorerCard } from "@/module/explorer/component/ExplorerCard";
import type { ExplorerMerchantItem } from "@/module/explorer/component/ExplorerCard/types";
import { ExplorerDetail } from "@/module/explorer/component/ExplorerDetail";
import { useGetExplorerMerchants } from "@/module/explorer/hook/useGetExplorerMerchants";

export function ExplorerList() {
    const { merchants, isLoading } = useGetExplorerMerchants();
    const { t } = useTranslation();
    const [selectedMerchant, setSelectedMerchant] =
        useState<ExplorerMerchantItem | null>(null);

    const handleCloseDetail = useCallback(() => {
        setSelectedMerchant(null);
    }, []);

    if (isLoading) {
        return (
            <Stack space="m">
                <Skeleton variant="rect" height={240} width="100%" />
                <Skeleton variant="rect" height={240} width="100%" />
            </Stack>
        );
    }

    if (merchants.length === 0) {
        return (
            <EmptyState
                title={t("explorer.empty.title")}
                description={t("explorer.empty.description")}
            />
        );
    }

    return (
        <>
            <Stack as="ul" space="m">
                {merchants.map((merchant) => (
                    <li key={merchant.id} style={{ listStyle: "none" }}>
                        <ExplorerCard
                            merchant={merchant}
                            onClick={() => setSelectedMerchant(merchant)}
                        />
                    </li>
                ))}
            </Stack>

            {selectedMerchant && (
                <ExplorerDetail
                    merchant={selectedMerchant}
                    onClose={handleCloseDetail}
                />
            )}
        </>
    );
}
