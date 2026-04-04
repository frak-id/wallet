import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useTranslation } from "react-i18next";
import { ExplorerCard } from "@/module/explorer/component/ExplorerCard";
import { useGetExplorerMerchants } from "@/module/explorer/hook/useGetExplorerMerchants";
import { modalStore } from "@/module/stores/modalStore";

export function ExplorerList() {
    const { merchants, isLoading } = useGetExplorerMerchants();
    const { t } = useTranslation();
    const openModal = modalStore((s) => s.openModal);

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
        <Stack as="ul" space="m">
            {merchants.map((merchant) => (
                <li key={merchant.id} style={{ listStyle: "none" }}>
                    <ExplorerCard
                        merchant={merchant}
                        onClick={() =>
                            openModal({
                                id: "explorerDetail",
                                merchant,
                            })
                        }
                    />
                </li>
            ))}
        </Stack>
    );
}
