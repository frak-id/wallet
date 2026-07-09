import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { useAppShellScroll } from "@/module/common/component/AppShell";
import { ExplorerCard } from "@/module/explorer/component/ExplorerCard";
import { useGetExplorerMerchants } from "@/module/explorer/hook/useGetExplorerMerchants";
import { explorerSortStore } from "@/module/explorer/stores/explorerSortStore";
import { modalStore } from "@/module/stores/modalStore";

export function ExplorerList() {
    const { merchants, isLoading } = useGetExplorerMerchants();
    const { t } = useTranslation();
    const openModal = modalStore((s) => s.openModal);

    // Reordering on a new sort makes the old scroll position meaningless, so
    // jump back to the top-ranked results (skip the first run — mount is
    // already at the top). Instant to avoid jank against the reorder.
    const scrollRef = useAppShellScroll();
    const sort = useStore(explorerSortStore, (s) => s.sort);
    const isInitialSort = useRef(true);
    useEffect(() => {
        if (isInitialSort.current) {
            isInitialSort.current = false;
            return;
        }
        scrollRef.current?.scrollTo({ top: 0 });
    }, [sort, scrollRef]);

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
