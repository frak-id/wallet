import { Stack } from "@frak-labs/design-system/components/Stack";
import { getRouteApi } from "@tanstack/react-router";
import type { ColumnFiltersState, Row } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { CampaignDetailsSheet } from "@/module/campaigns/component/CampaignDetailsSheet";
import { CampaignsEditBar } from "@/module/campaigns/component/TableCampaigns/CampaignsEditBar";
import { TableCampaignFilters } from "@/module/campaigns/component/TableCampaigns/Filter";
import {
    type CampaignWithStats,
    useCampaignsWithStats,
} from "@/module/campaigns/hook/useCampaignsWithStats";
import { Table } from "@/module/common/component/Table";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { campaignSelectionStore } from "@/stores/campaignSelectionStore";
import { useCampaignColumns } from "./columns";
import * as styles from "./table-campaigns.css";

const routeApi = getRouteApi("/_restricted/m/$merchantId/campaigns/list");

export function TableCampaigns() {
    const { data } = useCampaignsWithStats();
    const merchantId = useActiveMerchantId();
    const navigate = routeApi.useNavigate();
    const { campaign: selectedId, tab } = routeApi.useSearch();
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const selectedCampaign = useMemo(
        () => data.find((c) => c.id === selectedId),
        [data, selectedId]
    );
    const selectedIds = campaignSelectionStore((state) => state.selectedIds);
    const clearSelection = campaignSelectionStore((state) => state.clear);

    // Reset bulk selection whenever the active merchant changes — the
    // previous merchant's campaign ids no longer apply.
    useEffect(() => {
        clearSelection();
    }, [merchantId, clearSelection]);

    const selectedCampaigns = useMemo(
        () => (data ?? []).filter((c) => selectedIds.has(c.id)),
        [data, selectedIds]
    );

    const columns = useCampaignColumns({ merchantId });

    const rowDataAttributes = useMemo(
        () => ({
            "data-selected": (row: Row<CampaignWithStats>) =>
                selectedIds.has(row.original.id) ? "true" : undefined,
        }),
        [selectedIds]
    );

    return (
        <>
            <Stack space="l">
                <TableCampaignFilters
                    columnFilters={columnFilters}
                    setColumnFilters={setColumnFilters}
                />
                <Stack space="m">
                    {selectedCampaigns.length > 0 && (
                        <CampaignsEditBar
                            merchantId={merchantId}
                            selected={selectedCampaigns}
                        />
                    )}
                    <Table
                        className={styles.campaignsTable}
                        data={data}
                        columns={columns}
                        emptyPlaceholder="–"
                        enableSorting={true}
                        enableFiltering={true}
                        columnFilters={columnFilters}
                        onRowClick={(row) =>
                            navigate({
                                search: (prev) => ({
                                    ...prev,
                                    campaign: row.original.id,
                                    tab: undefined,
                                }),
                            })
                        }
                        rowDataAttributes={rowDataAttributes}
                        anySelected={selectedCampaigns.length > 0}
                    />
                </Stack>
            </Stack>
            <CampaignDetailsSheet
                campaign={selectedCampaign}
                tab={tab}
                onTabChange={(nextTab) =>
                    navigate({
                        search: (prev) => ({ ...prev, tab: nextTab }),
                    })
                }
                onOpenChange={(open) => {
                    if (!open)
                        navigate({
                            search: (prev) => ({
                                ...prev,
                                campaign: undefined,
                                tab: undefined,
                            }),
                        });
                }}
            />
        </>
    );
}
