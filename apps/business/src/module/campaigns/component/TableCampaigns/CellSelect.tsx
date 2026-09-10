import { Checkbox } from "@frak-labs/design-system/components/Checkbox";
import type { Row, Table } from "@tanstack/react-table";
import type { CampaignWithStats } from "@/module/campaigns/hook/useCampaignsWithStats";
import { campaignSelectionStore } from "@/stores/campaignSelectionStore";

export function CellSelect({ row }: { row: Row<CampaignWithStats> }) {
    const id = row.original.id;
    const checked = campaignSelectionStore((state) =>
        state.selectedIds.has(id)
    );
    const toggle = campaignSelectionStore((state) => state.toggle);

    return (
        <Checkbox
            id={`campaign-select-${id}`}
            size="l"
            checked={checked}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={() => toggle(id)}
        />
    );
}

export function HeaderSelect({ table }: { table: Table<CampaignWithStats> }) {
    const selectedIds = campaignSelectionStore((state) => state.selectedIds);
    const setMany = campaignSelectionStore((state) => state.setMany);
    const clear = campaignSelectionStore((state) => state.clear);

    const visibleIds = table.getRowModel().rows.map((r) => r.original.id);
    const selectedCount = visibleIds.filter((id) => selectedIds.has(id)).length;
    const checked =
        selectedCount === 0
            ? false
            : selectedCount === visibleIds.length || "indeterminate";

    return (
        <Checkbox
            id="campaign-select-all"
            size="l"
            checked={checked}
            disabled={visibleIds.length === 0}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={() =>
                selectedCount > 0 ? clear() : setMany(visibleIds)
            }
        />
    );
}
